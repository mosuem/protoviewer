import * as vscode from 'vscode';
import { ProtoPreview } from './protoPreview';

export class ProtoCustomProvider
  implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'protoviewer.preview';

  private readonly _previews = new Set<ProtoPreview>();
  private _activePreview: ProtoPreview | undefined;

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {}

  public openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: (): void => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewEditor: vscode.WebviewPanel
  ): Promise<void> {
    const preview = new ProtoPreview(
      this.extensionRoot,
      document.uri,
      webviewEditor,
      this.context
    );
    this._previews.add(preview);
    this.setActivePreview(preview);

    webviewEditor.onDidDispose(() => {
      preview.dispose();
      this._previews.delete(preview);
    });

    webviewEditor.onDidChangeViewState(() => {
      if (webviewEditor.active) {
        this.setActivePreview(preview);
      } else if (this._activePreview === preview && !webviewEditor.active) {
        this.setActivePreview(undefined);
      }
    });
  }

  public get activePreview(): ProtoPreview {
    return this._activePreview;
  }

  private setActivePreview(value: ProtoPreview | undefined): void {
    this._activePreview = value;
  }
}
