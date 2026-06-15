import CodeMirror, { EditorView, Extension } from '@uiw/react-codemirror';
import { useTheme } from '@/hooks/useTheme';

// CodeMirror draws its own caret as a left border on `.cm-cursor`, but Tailwind's preflight (`* { border-width: 0 }`)
// zeroes it, leaving no visible cursor. Restore the border (with `!important` to beat the preflight); `currentColor`
// keeps the caret the same colour as the text, so it stays visible in both light and dark themes. The `min-height`
// keeps the caret visible on an empty line, where CodeMirror otherwise measures its height as 0.
const caretFix = EditorView.theme({
	'.cm-cursor, .cm-cursor-primary': {
		borderLeftColor: 'currentColor !important',
		borderLeftWidth: '2px !important',
		minHeight: '1em !important'
	}
});

interface CodeEditorInputProps {
	value: string;
	onChange: ( value: string ) => void;
	extensions?: Extension[];
	disabled?: boolean;
	id?: string;
	placeholder?: string;
	height?: string;
	'aria-invalid'?: boolean;
}

/**
 * Code editor input, built on CodeMirror. Pass a language extension (e.g. css()) via
 * `extensions` for syntax highlighting; without it the editor is plain text.
 */
const CodeEditorInput = ({
	value,
	onChange,
	extensions = [],
	disabled = false,
	id,
	placeholder,
	height = '220px',
	...props
}: CodeEditorInputProps ) => {
	const { isDarkTheme } = useTheme();
	return (
		<div
			id={ id }
			aria-invalid={ props['aria-invalid'] }

			// Keep clicks and keystrokes inside the editor from bubbling to the block-select handler, so typing (incl.
			// pressing Enter) focuses/edits the editor instead of opening the block settings sidebar, matching WYSIWYG.
			onClick={ ( e ) => e.stopPropagation() }
			onKeyDown={ ( e ) => e.stopPropagation() }
			role="presentation"
			className={ `overflow-hidden rounded-md border border-gray-400 focus-within:border-primary-700 focus-within:ring-3 dark:border-gray-600 ${
				disabled ? 'cursor-not-allowed border-gray-200 bg-gray-200 opacity-60 dark:border-gray-700 dark:bg-gray-700' : ''
			}` }
		>
			<CodeMirror
				value={ value }
				height={ height }
				theme={ isDarkTheme ? 'dark' : 'light' }
				editable={ ! disabled }
				readOnly={ disabled }
				placeholder={ placeholder }
				extensions={ [ ...extensions, caretFix ] }
				onChange={ onChange }
				basicSetup={ {
					lineNumbers: true,
					foldGutter: false,
					highlightActiveLine: ! disabled
				} }
			/>
		</div>
	);
};

export default CodeEditorInput;
