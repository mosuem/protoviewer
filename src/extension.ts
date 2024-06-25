import { ExtensionContext, Uri, window } from 'vscode';
import { ProtoCustomProvider } from './protoProvider';

export function activate(context: ExtensionContext): void {
  const extensionRoot = Uri.file(context.extensionPath);
  // Register our custom editor provider
  const provider = new ProtoCustomProvider(extensionRoot);
  context.subscriptions.push(
    window.registerCustomEditorProvider(
      ProtoCustomProvider.viewType,
      provider,
      {
        webviewOptions: {
          enableFindWidget: false, // default
          retainContextWhenHidden: true,
        },
      }
    )
  );
}

export function deactivate(): void {}
