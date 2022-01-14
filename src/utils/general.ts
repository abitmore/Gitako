import { ReactElement } from 'react'
import * as ReactDOM from 'react-dom'

export function pick<T>(source: T, keys: string[]): Partial<T> {
  if (keys && typeof keys === 'object') {
    return (Array.isArray(keys) ? keys : Object.keys(keys)).reduce((copy, key) => {
      if (key in source) {
        copy[key as keyof T] = source[key as keyof T]
      }
      return copy
    }, {} as Partial<T>)
  }
  return {} as Partial<T>
}

export enum OperatingSystems {
  Windows = 'Windows',
  macOS = 'Macintosh',
  Linux = 'Linux',
  others = 'unknown',
}

function detectOS(): OperatingSystems {
  if (typeof window !== 'undefined') {
    const {
      navigator: { userAgent },
    } = window
    if (userAgent.indexOf(OperatingSystems.Windows) !== -1) return OperatingSystems.Windows
    else if (userAgent.indexOf(OperatingSystems.macOS) !== -1) return OperatingSystems.macOS
    else if (userAgent.indexOf(OperatingSystems.Linux) !== -1) return OperatingSystems.Linux
  }
  return OperatingSystems.others
}

export const os = detectOS()

export function friendlyFormatShortcut(shortcut?: string) {
  if (!shortcut) return ''
  if (os === OperatingSystems.Windows) {
    return shortcut.replace(/meta/, 'win')
  } else if (os === OperatingSystems.macOS) {
    return shortcut
      .replace(/meta/, '⌘')
      .replace(/ctrl/, '⌃')
      .replace(/shift/, '⇧')
      .replace(/alt/, '⌥')
      .toUpperCase()
  } else {
    return shortcut
  }
}

/**
 * if item's name matches path, return the depth of the item
 * else return 0
 */
function measureDistance(item: TreeNode, path: TreeNode['name'][]): number {
  const pathString = path.join('/')
  if (item.name.startsWith(pathString + '/')) {
    // If accessing a leading item of compressed node, path will be shorter than item.name
    return path.length
  } else if (pathString === item.name || pathString.startsWith(item.name + '/')) {
    return item.name.split('/').length
  }
  return 0
}

export async function traverse<T>(
  range: T[] = [],
  conditionAndEffect: (node: T) => Async<boolean>,
  getChildren: (node: T) => T[],
) {
  for (const item of range) {
    if (await conditionAndEffect(item)) {
      await traverse(getChildren(item), conditionAndEffect, getChildren)
    }
  }
}

/**
 * look for the first item matches given path under root.content
 */
export async function findNode(root: TreeNode, path: TreeNode['path']) {
  let node: TreeNode | undefined
  await traverse(
    [root],
    $node => {
      if (path === $node.path) {
        node = $node
        return false
      }
      return path.startsWith($node.path)
    },
    node => node.contents || [],
  )
  return node
}

export function createStyleSheet(content: string) {
  const style = document.createElement('style')
  style.appendChild(document.createTextNode(content))
  document.head.appendChild(style)
  return style
}

export function setStyleSheetMedia(style: HTMLStyleElement, media: string) {
  style.setAttribute('media', media)
}

export function parseURLSearch(search = window.location.search) {
  return new URLSearchParams(search)
}

export async function JSONRequest(url: string, data: any, extra: RequestInit = { method: 'post' }) {
  return (
    await fetch(url, {
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      method: extra.method || 'post',
      body: JSON.stringify(data),
      ...extra,
    })
  ).json()
}

export function searchKeyToRegexp(searchKey: string) {
  if (!searchKey) return null

  return safeRegexp(searchKey, hasUpperCase(searchKey) ? 'g' : 'gi')
}

export function hasUpperCase(input: string) {
  return /[A-Z]/.test(input)
}

export async function renderReact(element: ReactElement) {
  return new Promise<Node>(resolve => {
    const mount = document.createElement('div')
    ReactDOM.render(element, mount, () => {
      resolve(mount.childNodes[0])
    })
  })
}

export function safeRegexp(pattern: string | RegExp, flags?: string | undefined) {
  try {
    return new RegExp(pattern, flags)
  } catch (err) {
    return null
  }
}

export function isValidRegexpSource(source: string) {
  return Boolean(safeRegexp(source))
}

export function withEffect<Method extends (...args: any[]) => any>(
  method: Method,
  effect: (payload: ReturnType<Method>) => void,
): (...args: Parameters<Method>) => ReturnType<Method> {
  return (...args) => {
    const returnValue = method.apply(null, args)
    Promise.resolve(returnValue).then(effect)
    return returnValue
  }
}

export function run<T>(fn: () => T) {
  return fn()
}

export function createPromiseQueue() {
  let promise: Promise<void>
  return {
    async enter() {
      let leave: () => void
      const current = new Promise<void>(resolve => (leave = () => resolve()))

      const lastPromise = promise
      promise = current!
      if (lastPromise) await lastPromise

      return leave!
    },
  }
}

export function isOpenInNewWindowClick(event: React.MouseEvent<HTMLElement, MouseEvent>) {
  return (
    (os === OperatingSystems.macOS && (event.metaKey || event.shiftKey)) ||
    (os === OperatingSystems.Linux && event.ctrlKey) ||
    (os === OperatingSystems.Windows && event.ctrlKey)
  )
}

export function resolveDiffGraphMeta(additions: number, deletions: number, changes: number) {
  const both = additions > 0 && deletions > 0,
    overflow = changes > 5,
    preserved = both && overflow ? 1 : 0,
    g = overflow ? Math.floor(((5 - preserved) * (additions + 1)) / (changes + 1)) : additions,
    r = overflow ? 5 - preserved - g : deletions,
    w = 5 - g - r
  return { g, r, w }
}
