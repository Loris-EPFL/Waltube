import { Tusky } from "@tusky-io/ts-sdk";
import { createReadStream } from "fs";

const tusky = new Tusky({ apiKey: "305842a1-27d9-4510-ac66-3339580fb91f"});


// sign-in to Tusky (this will prompt the wallet & ask for user signature)
await tusky.auth.signIn();

const { id: vaultId } = await tusky.vault.create("My public vault", { encrypted: true });

const vaults = await tusky.vault.listAll();

const path = "/path/to/my/file.jpg";
const fileStream = createReadStream(path);


//keeping uploadId by path here
const uploadId = await tusky.file.upload(vaultId, path);
const uploadId_stream  = await tusky.file.upload(vaultId, fileStream, { name: "file.jpg", mimeType: "image/jpeg" });
const uploadId_buffer = await tusky.file.upload(vaultId, new Blob(["hello world"]), {
    name: "hello_world.txt",
    mimeType: "text/plain",
});


const fileMetadata = await tusky.file.get(uploadId);

// blobId - file reference off chain
// computed deterministically from blob content
console.log("File Walrus blob id: " + fileMetadata.blobId);

// blobObjectId - file reference on chain
console.log("File Sui object id: " + fileMetadata.blobObjectId);


//dl file 
const fileBuffer = await tusky.file.arrayBuffer(uploadId);