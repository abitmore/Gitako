import * as ini from 'ini'
import DOMHelper from 'utils/DOMHelper'
import treeParser from 'utils/treeParser'
import URLHelper from 'utils/URLHelper'
import VisibleNodesGenerator, { TreeNode } from 'utils/VisibleNodesGenerator'
import GitHubHelper, { BlobData, TreeData, MetaData } from 'utils/GitHubHelper'
import { MethodCreator } from 'driver/connect'
import { Props } from 'components/FileExplorer'
import Node from 'components/Node'
import { VisibleNodes } from 'components/SideBar'

export type ConnectorState = {
  stateText: string
  visibleNodes: VisibleNodes

  init: () => void
  execAfterRender: () => void
  handleKeyDown: React.KeyboardEventHandler
  handleSearchKeyChange: React.FormEventHandler
  onNodeClick: Node['props']['onClick']
  onFocusSearchBar: React.FocusEventHandler
  setUpTree: (treeData?: TreeData) => void
}

type DepthMap = Map<TreeNode, number>

function getVisibleParentNode(nodes: TreeNode[], focusedNode: TreeNode, depths: DepthMap) {
  const focusedNodeIndex = nodes.indexOf(focusedNode)
  const focusedNodeDepth = depths.get(focusedNode)
  let indexOfParentNode = focusedNodeIndex - 1
  let depth: number | undefined
  while (indexOfParentNode !== -1) {
    depth = depths.get(nodes[indexOfParentNode])
    if (depth === undefined || focusedNodeDepth === undefined || !(depth >= focusedNodeDepth)) {
      break
    }
    --indexOfParentNode
  }
  const parentNode = nodes[indexOfParentNode]
  return parentNode
}

type Task = () => void
const tasksAfterRender: (Task)[] = []
const visibleNodesGenerator = new VisibleNodesGenerator()

const init: MethodCreator<Props, ConnectorState> = dispatch => () =>
  dispatch.call(setStateText, 'Fetching File List...')

function resolveGitModules(root: TreeNode, blobData: BlobData) {
  if (blobData) {
    if (blobData.encoding === 'base64' && blobData.content && Array.isArray(root.contents)) {
      const content = atob(blobData.content)
      const parsed = ini.parse(content)
      Object.values(parsed).map((value: { url: string; path: string }) => {
        const { url, path } = value
        // for now, handle modules at root only
        const node = Array.isArray(root.contents) && root.contents.find(node => node.path === path)
        if (node) {
          node.url = url
        }
      })
    }
  }
}

const setUpTree: MethodCreator<Props, ConnectorState> = dispatch => () =>
  dispatch.get(async (_, { treeData, metaData, compressSingletonFolder, accessToken }) => {
    if (!treeData) return
    dispatch.call(setStateText, 'Rendering File List...')
    const { root, gitModules } = treeParser.parse(treeData, metaData)

    if (gitModules) {
      if (metaData.userName && metaData.repoName && gitModules.sha) {
      const blobData = await GitHubHelper.getBlobData({
        userName: metaData.userName,
        repoName: metaData.repoName,
        fileSHA: gitModules.sha,
        accessToken,
      })

      resolveGitModules(root as TreeNode, blobData)
    }

    visibleNodesGenerator.setCompress(compressSingletonFolder)
    await visibleNodesGenerator.plantTree(root as TreeNode)

    tasksAfterRender.push(DOMHelper.focusSearchInput)
    dispatch.call(setStateText, '')
    const currentPath = URLHelper.getCurrentPath(metaData.branchName)
    if (currentPath.length) {
      const nodeExpandedTo = visibleNodesGenerator.expandTo(currentPath.join('/'))
      if (nodeExpandedTo) {
        visibleNodesGenerator.focusNode(nodeExpandedTo)
        const { nodes } = visibleNodesGenerator.visibleNodes
        tasksAfterRender.push(() => DOMHelper.scrollToNodeElement(nodes.indexOf(nodeExpandedTo)))
      }
    }
    dispatch.call(updateVisibleNodes)
  })

const execAfterRender: MethodCreator<Props, ConnectorState> = dispatch => () => {
  for (const task of tasksAfterRender) {
    task()
  }
  tasksAfterRender.length = 0
}

const setStateText: MethodCreator<
  Props,
  ConnectorState,
  [ConnectorState['stateText']]
> = dispatch => (text: string) =>
  dispatch.set({
    stateText: text,
  })

const handleKeyDown: MethodCreator<
  Props,
  ConnectorState,
  [React.KeyboardEvent]
> = dispatch => event =>
  dispatch.get(({ visibleNodes: { nodes, focusedNode, expandedNodes, depths } }) => {
    function handleVerticalMove(index: number) {
      if (0 <= index && index < nodes.length) {
        DOMHelper.focusFileExplorer()
        dispatch.call(focusNode, nodes[index], false)
      } else {
        DOMHelper.focusSearchInput()
        dispatch.call(focusNode, null, false)
      }
    }

    const { key } = event
    // prevent document body scrolling if the keypress results in Gitako action
    let muteEvent = true
    if (focusedNode) {
      const focusedNodeIndex = nodes.indexOf(focusedNode)
      switch (key) {
        case 'ArrowUp':
          // focus on previous node
          handleVerticalMove(focusedNodeIndex - 1)
          break

        case 'ArrowDown':
          // focus on next node
          handleVerticalMove(focusedNodeIndex + 1)
          break

        case 'ArrowLeft':
          // collapse node or go to parent node
          if (expandedNodes.has(focusedNode)) {
            dispatch.call(setExpand, focusedNode, false)
          } else {
            // go forward to the start of the list, find the closest node with lower depth
            const parentNode = getVisibleParentNode(nodes, focusedNode, depths)
            if (parentNode) {
              dispatch.call(focusNode, parentNode, false)
            }
          }
          break

        // consider the two keys as 'confirm' key
        case 'ArrowRight':
          // expand node or focus on first content node or redirect to file page
          if (focusedNode.type === 'tree') {
            if (expandedNodes.has(focusedNode)) {
              const nextNode = nodes[focusedNodeIndex + 1]
              const d1 = depths.get(nextNode)
              const d2 = depths.get(focusedNode)
              if (d1 !== undefined && d2 !== undefined && d1 > d2) {
                dispatch.call(focusNode, nextNode, false)
              }
            } else {
              dispatch.call(setExpand, focusedNode, true)
            }
          } else if (focusedNode.type === 'blob') {
            if (focusedNode.url) DOMHelper.loadWithPJAX(focusedNode.url)
          } else if (focusedNode.type === 'commit') {
            window.open(focusedNode.url)
          }
          break
        case 'Enter':
          // expand node or redirect to file page
          if (focusedNode.type === 'tree') {
            dispatch.call(setExpand, focusedNode, true)
          } else if (focusedNode.type === 'blob') {
            if (focusedNode.url) DOMHelper.loadWithPJAX(focusedNode.url)
          } else if (focusedNode.type === 'commit') {
            window.open(focusedNode.url)
          }
          break
        default:
          muteEvent = false
      }
      if (muteEvent) {
        event.preventDefault()
      }
    } else {
      // now search input is focused
      if (nodes.length) {
        switch (key) {
          case 'ArrowDown':
            DOMHelper.focusFileExplorer()
            dispatch.call(focusNode, nodes[0], false)
            break
          case 'ArrowUp':
            DOMHelper.focusFileExplorer()
            dispatch.call(focusNode, nodes[nodes.length - 1], false)
            break
          default:
            muteEvent = false
        }
        if (muteEvent) {
          event.preventDefault()
        }
      }
    }
  })

const onFocusSearchBar: MethodCreator<Props, ConnectorState> = dispatch => () =>
  dispatch.call(focusNode, null, false)

const handleSearchKeyChange: MethodCreator<
  Props,
  ConnectorState,
  [React.FormEvent<HTMLInputElement>]
> = dispatch => {
  let i = 0
  return async event => {
    const searchKey = event.currentTarget.value
    const j = (i += 1)
    await visibleNodesGenerator.search(searchKey)
    if (i === j) dispatch.call(updateVisibleNodes)
  }
}

const delayExpandThreshold = 400
function shouldDelayExpand(node: TreeNode) {
  return (
    visibleNodesGenerator.visibleNodes.expandedNodes.has(node) &&
    Array.isArray(node.contents) &&
    node.contents.length > delayExpandThreshold
  )
}

const setExpand: MethodCreator<Props, ConnectorState, [TreeNode, boolean]> = dispatch => (
  node,
  expand = false,
) => {
  visibleNodesGenerator.setExpand(node, expand)
  const applyChanges = () => dispatch.call(focusNode, node, false)
  if (shouldDelayExpand(node)) {
    dispatch.call(mountExpandingIndicator, node)
    tasksAfterRender.push(() => setTimeout(applyChanges, 0))
  } else {
    applyChanges()
  }
}

const toggleNodeExpansion: MethodCreator<Props, ConnectorState, [TreeNode, boolean]> = dispatch => (
  node,
  skipScrollToNode,
) => {
  visibleNodesGenerator.toggleExpand(node)
  const applyChanges = () => {
    dispatch.call(focusNode, node, skipScrollToNode)
    tasksAfterRender.push(DOMHelper.focusFileExplorer)
  }
  if (shouldDelayExpand(node)) {
    dispatch.call(mountExpandingIndicator, node)
    tasksAfterRender.push(() => setTimeout(applyChanges, 0))
  } else {
    applyChanges()
  }
}

const focusNode: MethodCreator<Props, ConnectorState, [TreeNode | null, boolean]> = dispatch => (
  node: TreeNode | null,
  skipScroll = false,
) =>
  dispatch.get(({ visibleNodes: { nodes } }) => {
    visibleNodesGenerator.focusNode(node)
    if (node && !skipScroll) {
      // when focus a node not in viewport(by keyboard), scroll to it
      const indexOfToBeFocusedNode = nodes.indexOf(node)
      tasksAfterRender.push(() => DOMHelper.scrollToNodeElement(indexOfToBeFocusedNode))
    }
    dispatch.call(updateVisibleNodes)
  })

const onNodeClick: MethodCreator<Props, ConnectorState, [TreeNode]> = dispatch => node => {
  if (node.type === 'tree') {
    dispatch.call(toggleNodeExpansion, node, true)
  } else if (node.type === 'blob') {
    dispatch.call(focusNode, node, true)
    if (node.url) DOMHelper.loadWithPJAX(node.url)
  } else if (node.type === 'commit') {
    window.open(node.url, '_blank')
  }
}

const mountExpandingIndicator: MethodCreator<
  Props,
  ConnectorState,
  [TreeNode]
> = dispatch => node =>
  dispatch.get(({ visibleNodes }) => {
    const dummyVisibleNodes = {
      ...visibleNodes,
      nodes: visibleNodes.nodes.slice(),
    }
    dummyVisibleNodes.nodes.splice(dummyVisibleNodes.nodes.indexOf(node) + 1, 0, {
      virtual: true,
      name: 'Loading',
      path: '-',
      type: 'virtual',
    })
    dispatch.set({
      visibleNodes: dummyVisibleNodes,
    })
  })

const updateVisibleNodes: MethodCreator<Props, ConnectorState> = dispatch => () => {
  const { visibleNodes } = visibleNodesGenerator
  dispatch.set({ visibleNodes })
}

export default {
  init,
  setUpTree,
  execAfterRender,
  setStateText,
  handleKeyDown,
  onFocusSearchBar,
  handleSearchKeyChange,
  setExpand,
  toggleNodeExpansion,
  focusNode,
  onNodeClick,
  updateVisibleNodes,
  mountExpandingIndicator,
}
