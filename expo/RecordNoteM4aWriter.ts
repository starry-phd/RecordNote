/** Shared React Native + Expo implementation.
 * Requires Expo SDK with new expo-file-system File.open(), FileHandle.readBytes/writeBytes.
 * This is a production integration ADAPTER, not evidence of an app-store binary build.
 */
import {File, Paths} from 'expo-file-system';
import {embedMdtaStream, readMdtaStream} from '../src/m4a-mdta.mjs';

export type NativeWriterResult = {
  uri: string;
  metadataKeys: string[];
  originalUri: string;
  verified: true;
  bytes: number;
};

/** Return a NEW file. Never modify the input audio in place. */
export async function writeFutureRecordingM4a({
  originalUri, mdtaValues,
}: {
  originalUri: string;
  mdtaValues: Record<string, string>;
}): Promise<NativeWriterResult> {
  const source = new File(originalUri);
  if (!source.exists || !originalUri.toLowerCase().split('?')[0].endsWith('.m4a')) {
    throw new Error('RECORDNOTE_M4A_SOURCE_NOT_SUPPORTED');
  }
  const destination = new File(Paths.cache, `recordnote-tagged-${Date.now()}-${Math.round(Math.random()*1e9)}.m4a`);
  destination.create();
  const input = source.open();
  const output = destination.open();
  let result: Awaited<ReturnType<typeof embedMdtaStream>>;
  try {
    result = await embedMdtaStream({
      size: source.size,
      readAt: async (offset, length) => {
        input.offset = offset;
        return await input.readBytes(length);
      },
      write: async bytes => { await output.writeBytes(bytes); },
    }, mdtaValues);
  } catch (error) {
    input.close(); output.close(); destination.delete();
    throw error;
  }
  input.close(); output.close();

  // Re-open and independently verify keys before returning any output URI.
  const verificationFile = destination.open();
  let verified = false;
  try {
    const actual = await readMdtaStream({
      size: destination.size,
      readAt: async (offset, length) => {
        verificationFile.offset = offset;
        return await verificationFile.readBytes(length);
      },
    });
    for (const [key, value] of Object.entries(mdtaValues)) {
      if (!key.startsWith('com.apple.quicktime.') || !value) continue;
      if (actual[key] !== value) throw Error(`M4A_METADATA_READBACK_FAILED:${key}`);
    }
    verified = true;
    return {
      uri: destination.uri,
      metadataKeys: result.metadataKeys,
      originalUri,
      bytes: result.bytes,
      verified: true,
    };
  } finally {
    verificationFile.close();
    if (!verified) destination.delete();
  }
}