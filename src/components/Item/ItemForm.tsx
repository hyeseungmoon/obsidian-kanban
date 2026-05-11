import { EditorView } from '@codemirror/view';
import { TFile, moment } from 'obsidian';
import { Dispatch, StateUpdater, useContext, useEffect, useRef } from 'preact/hooks';
import useOnclickOutside from 'react-cool-onclickoutside';
import { t } from 'src/lang/helpers';

import { MarkdownEditor, allowNewLine } from '../Editor/MarkdownEditor';
import { getDropAction } from '../Editor/helpers';
import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, EditingState, Item, isEditing } from '../types';

interface ItemFormProps {
  addItems: (items: Item[]) => void;
  editState: EditState;
  setEditState: Dispatch<StateUpdater<EditState>>;
  hideButton?: boolean;
}

export function ItemForm({ addItems, editState, setEditState, hideButton }: ItemFormProps) {
  const { stateManager } = useContext(KanbanContext);
  const editorRef = useRef<EditorView>();

  const clear = () => setEditState(EditingState.cancel);
  const clickOutsideRef = useOnclickOutside(clear, {
    ignoreClass: [c('ignore-click-outside'), 'mobile-toolbar', 'suggestion-container'],
  });

  const createItem = (title: string) => {
    addItems([stateManager.getNewItem(title, ' ')]);
    const cm = editorRef.current;
    if (cm) {
      cm.dispatch({
        changes: {
          from: 0,
          to: cm.state.doc.length,
          insert: '',
        },
      });
    }
  };

  useEffect(() => {
    if (!isEditing(editState)) return;

    const templatePath = stateManager.getSetting('card-template');
    if (!templatePath) return;

    const file = stateManager.app.vault.getAbstractFileByPath(templatePath as string);
    if (!(file instanceof TFile)) return;

    stateManager.app.vault.read(file).then((raw) => {
      // Try Templater API first
      const templater = (stateManager.app as any).plugins?.plugins?.['templater-obsidian'];
      const processContent = (content: string) => {
        // Basic date substitution fallback
        return content.replace(/<% tp\.date\.now\("([^"]+)"\) %>/g, (_, fmt) => {
          return moment().format(fmt);
        });
      };

      const applyToEditor = (content: string) => {
        const cm = editorRef.current;
        if (cm && content.trim()) {
          cm.dispatch({
            changes: { from: 0, to: cm.state.doc.length, insert: content.trim() },
          });
        }
      };

      if (templater?.templater?.parse_template) {
        templater.templater
          .parse_template({ isTFolder: false, content: raw, file }, raw)
          .then(applyToEditor)
          .catch(() => applyToEditor(processContent(raw)));
      } else {
        applyToEditor(processContent(raw));
      }
    });
  }, [editState]);

  if (isEditing(editState)) {
    return (
      <div className={c('item-form')} ref={clickOutsideRef}>
        <div className={c('item-input-wrapper')}>
          <MarkdownEditor
            editorRef={editorRef}
            editState={{ x: 0, y: 0 }}
            className={c('item-input')}
            placeholder={t('Card title...')}
            onEnter={(cm, mod, shift) => {
              if (!allowNewLine(stateManager, mod, shift)) {
                createItem(cm.state.doc.toString());
                return true;
              }
            }}
            onSubmit={(cm) => {
              createItem(cm.state.doc.toString());
            }}
            onEscape={clear}
          />
        </div>
      </div>
    );
  }

  if (hideButton) return null;

  return (
    <div className={c('item-button-wrapper')}>
      <button
        className={c('new-item-button')}
        onClick={() => setEditState({ x: 0, y: 0 })}
        onDragOver={(e) => {
          if (getDropAction(stateManager, e.dataTransfer)) {
            setEditState({ x: 0, y: 0 });
          }
        }}
      >
        <span className={c('item-button-plus')}>+</span> {t('Add a card')}
      </button>
    </div>
  );
}
