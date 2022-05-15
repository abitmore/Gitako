import { Icon } from 'components/Icon'
import { platform } from 'platforms'
import { GitHub } from 'platforms/GitHub'
import * as React from 'react'
import { useStateIO } from 'utils/hooks/useStateIO'
import { SimpleField, SimpleToggleField } from '../SimpleToggleField'
import { AccessTokenSettings } from './AccessTokenSettings'
import { FileTreeSettings } from './FileTreeSettings'
import { SettingsSection } from './SettingsSection'
import { SidebarSettings } from './SidebarSettings'

const WIKI_HOME_LINK = 'https://github.com/EnixCoda/Gitako/wiki'
export const wikiLinks = {
  compressSingletonFolder: `${WIKI_HOME_LINK}/Compress-Singleton-Folder`,
  changeLog: `${WIKI_HOME_LINK}/Change-Log`,
  codeFolding: `${WIKI_HOME_LINK}/Code-folding`,
  copyFileButton: `${WIKI_HOME_LINK}/Copy-file-and-snippet`,
  copySnippet: `${WIKI_HOME_LINK}/Copy-file-and-snippet`,
  createAccessToken: `${WIKI_HOME_LINK}/Access-token-for-Gitako`,
}

const moreFields: SimpleField<'copyFileButton' | 'copySnippetButton' | 'codeFolding'>[] =
  platform === GitHub
    ? [
        {
          key: 'codeFolding',
          label: 'Fold source code button',
          wikiLink: wikiLinks.codeFolding,
          tooltip: `Read more in Gitako's Wiki`,
        },
        {
          key: 'copyFileButton',
          label: 'Copy file button',
          wikiLink: wikiLinks.copyFileButton,
          tooltip: `Read more in Gitako's Wiki`,
        },
        {
          key: 'copySnippetButton',
          label: 'Copy snippet button',
          wikiLink: wikiLinks.copySnippet,
          tooltip: `Read more in Gitako's Wiki`,
        },
      ]
    : []

export function SettingsBarContent({ toggleShow }: { toggleShow: () => void }) {
  const useReloadHint = useStateIO<React.ReactNode>('')
  const { value: reloadHint } = useReloadHint

  return (
    <div className={'gitako-settings-bar'}>
      <div className={'gitako-settings-bar-header'}>
        <h2 className={'gitako-settings-bar-title'}>Settings</h2>
        <button className={'settings-button'} onClick={toggleShow}>
          <Icon type={'chevron-down'} className={'hide-settings-icon'} />
        </button>
      </div>
      <div className={'gitako-settings-bar-content'}>
        <div className={'shadow-shelter'} />
        <AccessTokenSettings />
        <SidebarSettings />
        <FileTreeSettings />
        {moreFields.length > 0 && (
          <SettingsSection title={'More'}>
            {moreFields.map(field => (
              <React.Fragment key={field.key}>
                <SimpleToggleField field={field} />
              </React.Fragment>
            ))}

            {reloadHint && <div className={'hint'}>{reloadHint}</div>}
          </SettingsSection>
        )}
        <SettingsSection title={'Talk to the author'}>
          <a
            href="https://github.com/EnixCoda/Gitako/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report bug
          </a>
          {' / '}
          <a
            href="https://github.com/EnixCoda/Gitako/discussions"
            target="_blank"
            rel="noopener noreferrer"
          >
            Discuss feature
          </a>
        </SettingsSection>
      </div>
    </div>
  )
}
