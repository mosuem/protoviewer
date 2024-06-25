import * as vscode from 'vscode';
import { Disposable } from './disposable';
import { decodeProtobuf } from './protoparser';

type PreviewState = 'Disposed' | 'Visible' | 'Active';

export class ProtoPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel
  ) {
    super();
    const resourceRoot = resource.with({
      path: resource.path.replace(/\/[^/]+?\.\w+$/, '/'),
    });

    webviewEditor.webview.options = {
      enableScripts: true,
      localResourceRoots: [resourceRoot, extensionRoot],
    };

    this._register(
      webviewEditor.webview.onDidReceiveMessage((message) => {
        switch (message.type) {
          case 'reopen-as-text': {
            vscode.commands.executeCommand(
              'vscode.openWith',
              resource,
              'default',
              webviewEditor.viewColumn
            );
            break;
          }
        }
      })
    );

    this._register(
      webviewEditor.onDidChangeViewState(() => {
        this.update();
      })
    );

    this._register(
      webviewEditor.onDidDispose(() => {
        this._previewState = 'Disposed';
      })
    );

    const watcher = this._register(
      vscode.workspace.createFileSystemWatcher(resource.fsPath)
    );
    this._register(
      watcher.onDidChange((e) => {
        if (e.toString() === this.resource.toString()) {
          this.reload();
        }
      })
    );
    this._register(
      watcher.onDidDelete((e) => {
        if (e.toString() === this.resource.toString()) {
          this.webviewEditor.dispose();
        }
      })
    );

    this.webviewEditor.webview.html = this.getWebviewContents();
    this.update();
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.webviewEditor.webview.postMessage({ type: 'reload' });
    }
  }

  private update(): void {
    if (this._previewState === 'Disposed') {
      return;
    }

    if (this.webviewEditor.active) {
      this._previewState = 'Active';
      return;
    }
    this._previewState = 'Visible';
  }

  private getWebviewContents(): string {
    const webview = this.webviewEditor.webview;
    const docPath = webview.asWebviewUri(this.resource);

    const config = vscode.workspace.getConfiguration('protoviewer');
    const protoPath = vscode.Uri.parse(config.get('proto-path'));
    const messageName = config.get('message-name') as string;
    console.log(config);

    const head = `<!DOCTYPE html>
<html dir="ltr" mozdisallowselectionprint>
<head>
<meta charset="utf-8">
</head>`;

    const body =
      messageName == null || protoPath == null
        ? 'Please add your proto-path and message-name args'
        : `<pre id="json">` +
          decodeProtobuf(docPath, protoPath, messageName) +
          `</pre>`;

    const tail = ['</html>'].join('\n');

    return head + body + tail;
  }
}
