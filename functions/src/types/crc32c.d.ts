/**
 * Type declarations for the CRC32C module from @google-cloud/storage
 * This module provides CRC32C checksum functionality for Google Cloud Storage
 */
declare module "@google-cloud/storage/build/cjs/src/crc32c" {
    /**
     * Class providing CRC32C checksum functionality
     */
    class CRC32C {
      static readonly CRC32C_EXTENSION_TABLE: Int32Array & {
            buffer: ArrayBuffer
        };
    }
    const CRC32C_EXTENSION_TABLE: Int32Array & { buffer: ArrayBuffer };
    export {CRC32C, CRC32C_EXTENSION_TABLE};
}
