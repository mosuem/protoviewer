import * as vscode from 'vscode';
import { Disposable } from './disposable';
import { decodeProtobuf } from './protoparser';
import protobuf = require('protobufjs');

type PreviewState = 'Disposed' | 'Visible' | 'Active';

export class ProtoPreview extends Disposable {
  private _previewState: PreviewState = 'Visible';

  constructor(
    private readonly extensionRoot: vscode.Uri,
    private readonly resource: vscode.Uri,
    private readonly webviewEditor: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext
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
    this.getWebviewContents(context).then((html) => {
      this.webviewEditor.webview.html = html;
      this.update();
    });
  }

  private reload(): void {
    if (this._previewState !== 'Disposed') {
      this.getWebviewContents(this.context).then((html) => {
        this.webviewEditor.webview.html = html;
        this.update();
      });
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

  private async getWebviewContents(
    context: vscode.ExtensionContext
  ): Promise<string> {
    const webview = this.webviewEditor.webview;
    const docPath = webview.asWebviewUri(this.resource);
    const protos = JSON.parse(
      context.globalState.get('protoviewer.protos') ?? '[]'
    ) as string[];
    const quickPick = await vscode.window.showQuickPick(
      [...protos, 'Add new proto'],
      {
        canPickMany: false,
      }
    );
    const head = `<!DOCTYPE html>
<html dir="ltr" mozdisallowselectionprint>
<head>
<meta charset="utf-8">
</head>`;

    const tail = ['</html>'].join('\n');
    let body: string;
    if (quickPick) {
      let result: vscode.Uri | undefined;
      if (quickPick == 'Add new proto') {
        const filePick = await vscode.window.showOpenDialog({
          openLabel: 'Add proto',
          canSelectMany: false,
          filters: {
            Protobuffer: ['proto'],
          },
        });
        if (filePick) {
          result = filePick[0];

          protos.push(result.path);
          context.globalState.update(
            'protoviewer.protos',
            JSON.stringify(protos)
          );
        }
      } else {
        result = vscode.Uri.parse(quickPick);
      }
      if (result) {
        const root = protobuf.loadSync(result.path);
        console.log(root);
        const messageNames = root.nestedArray
          .map((value) => {
            return (value as protobuf.Namespace).nestedArray;
          })
          .reduce((accumulator, value) => accumulator.concat(value), [])
          .map((value) => {
            return value.name;
          });
        const messageNamePick = await vscode.window.showQuickPick(
          messageNames,
          {
            canPickMany: false,
          }
        );
        if (messageNamePick) {
          body =
            messageNamePick == null
              ? 'Please add your proto-path and message-name args'
              : `<pre id="json">` +
                decodeProtobuf(docPath, root, messageNamePick) +
                `</pre>`;
          return head + body + tail;
        }
      }
    }
    return head + 'No proto selected' + tail;
  }
}
