import protobuf = require('protobufjs');
import { Uri } from 'vscode';
import fs = require('fs');

export function decodeProtobuf(
  filePath: Uri,
  protoPath: Uri,
  messageType: string
): string {
  const buffer = fs.readFileSync(filePath.path);
  try {
    const root = protobuf.loadSync(protoPath.path);
    const decoded = root.lookupType(messageType).decode(buffer);
    return JSON.stringify(decoded.toJSON(), null, '  ');
  } catch (error) {
    return `Error decoding ${filePath} with ${protoPath} and ${messageType}`;
  }
}
