import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { ExifTool } from "exiftool-vendored";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";

import app from "../../src/app.js";
import { attachments } from "../../src/modules/attachment/attachment.model.js";
import { UPLOAD_DIR } from "../../src/modules/attachment/attachment.upload.js";
import { auditLogs } from "../../src/modules/audit/auditLog.model.js";
import { records } from "../../src/modules/record/record.model.js";
import { messages } from "../../src/shared/messages.js";
import { API, createVerifiedUser, findAuditLogs, userData } from "./helpers.js";
import { adminQuery, appClient, countRows, testDb } from "./database.js";

type Agent = ReturnType<typeof request.agent>;

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAgAAAQABAAD//gARTGF2YzU4LjEzNC4xMDAA/9sAQwAIBAQEBAQFBQUFBQUGBgYGBgYGBgYGBgYGBwcHCAgIBwcHBgYHBwgICAgJCQkICAgICQkKCgoMDAsLDg4OEREU/8QATAABAQAAAAAAAAAAAAAAAAAAAAYBAQEAAAAAAAAAAAAAAAAAAAYHEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAAgACAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AiwBRf3//2Q==",
  "base64",
);
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP4y8AARAwQCgAfrgP19hgqWQAAAABJRU5ErkJggg==",
  "base64",
);
const WEBP = Buffer.from(
  "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoCAAIAAgA0JaACdLoB+AADsAD+8Oj3/yC5YXXI1/8gP+QH/ID/+PIAAAA=",
  "base64",
);
const PDF = Buffer.from("%PDF-1.4\n%conteudo\n");
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom"),
  Buffer.from([0, 0, 2, 0]),
  Buffer.from("isomiso2"),
]);

const exiftool = new ExifTool({ maxProcs: 1 });

afterAll(async () => {
  await exiftool.end();
});

const withMetadata = async (image: Buffer, extension: string) => {
  const dir = await mkdtemp(join(tmpdir(), "attachment-test-"));
  const path = join(dir, `foto.${extension}`);

  try {
    await writeFile(path, image);
    await exiftool.write(
      path,
      {
        GPSLatitude: -23.5,
        GPSLongitude: -46.6,
        Make: "CameraDaMaria",
        "XMP:Creator": "MariaDaSilva",
        CreateDate: "2026:01:01 10:00:00",
      },
      { writeArgs: ["-overwrite_original", "-Orientation#=6"] },
    );

    return await readFile(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const readTags = async (file: Buffer, extension: string) => {
  const dir = await mkdtemp(join(tmpdir(), "attachment-test-"));
  const path = join(dir, `foto.${extension}`);

  try {
    await writeFile(path, file);
    return await exiftool.read(path, { readArgs: ["-n"] });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const signedInAgent = async (overrides: Partial<typeof userData> = {}) => {
  const user = await createVerifiedUser(overrides);
  const agent = request.agent(app);

  await agent
    .post(`${API}/auth/signin`)
    .send({
      email: overrides.email ?? userData.email,
      password: overrides.password ?? userData.password,
    })
    .expect(200);

  return { user, agent };
};

const otherNurse = () =>
  signedInAgent({ email: "ana@example.com", coren: "654321" });

const imageConsent = {
  type: "image_capture",
  method: "written",
  grantor: "patient",
};

const consentsUrl = (patientId: string) =>
  `${API}/patients/${patientId}/consents`;

const createPatient = async (
  agent: Agent,
  { birthDate = "1950-03-15", withConsent = true } = {},
) => {
  const response = await agent
    .post(`${API}/patients`)
    .send({ name: "José da Silva", birthDate })
    .expect(201);
  const patientId = response.body.id as string;

  if (withConsent) {
    await agent.post(consentsUrl(patientId)).send(imageConsent).expect(201);
  }

  return patientId;
};

const attachmentsUrl = (patientId: string) =>
  `${API}/patients/${patientId}/attachments`;

const downloadUrl = (patientId: string, attachmentId: string) =>
  `${attachmentsUrl(patientId)}/${attachmentId}/download`;

const recordsUrl = (patientId: string) =>
  `${API}/patients/${patientId}/records`;

const send = (
  agent: Agent,
  patientId: string,
  file = PNG,
  filename = "ferida maria.png",
) => agent.post(attachmentsUrl(patientId)).attach("file", file, { filename });

const upload = async (agent: Agent, patientId: string, file = PNG) => {
  const response = await send(agent, patientId, file).expect(201);
  return response.body.id as string;
};

const fetchStored = async (
  agent: Agent,
  patientId: string,
  attachmentId: string,
) => {
  const response = await agent
    .get(downloadUrl(patientId, attachmentId))
    .expect(200);
  const file = await fetch(response.body.downloadUrl);
  expect(file.status).toBe(200);
  return Buffer.from(await file.arrayBuffer());
};

const code = (key: keyof typeof messages) => ({ code: key });

const expectNoTemporaryFiles = () =>
  vi.waitFor(async () => {
    expect(await readdir(UPLOAD_DIR)).toEqual([]);
  });

describe("Attachments", () => {
  describe("upload", () => {
    it("should store the file without a record and audit it", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await send(agent, patientId, PDF, "exame.pdf").expect(
        201,
      );

      expect(response.body).toMatchObject({
        patientId,
        recordId: null,
        fileName: "exame.pdf",
        contentType: "application/pdf",
        size: PDF.length,
        sha256: createHash("sha256").update(PDF).digest("hex"),
      });
      expect(response.body).not.toHaveProperty("storageKey");

      expect(await fetchStored(agent, patientId, response.body.id)).toEqual(
        PDF,
      );

      const logs = await findAuditLogs(eq(auditLogs.userId, user.id));
      expect(logs).toContainEqual(
        expect.objectContaining({
          action: "attachment.upload",
          resourceType: "attachment",
          resourceId: response.body.id,
          patientId,
        }),
      );
    });

    it("should keep a non-ASCII file name", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await send(agent, patientId, PNG, "ação.png").expect(
        201,
      );

      expect(response.body.fileName).toBe("ação.png");
    });

    it("should detect the type from the content, not from the request", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(attachmentsUrl(patientId))
        .attach("file", MP4, { filename: "a.png", contentType: "image/png" })
        .expect(201);

      expect(response.body.contentType).toBe("video/mp4");
    });

    it.each([
      ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
      ["an empty file", Buffer.alloc(0)],
      ["an executable", Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0])],
    ])("should refuse %s disguised as an image", async (_name, file) => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(attachmentsUrl(patientId))
        .attach("file", file, { filename: "a.png", contentType: "image/png" })
        .expect(422);

      expect(response.body).toMatchObject(code("ATTACHMENT_TYPE_NOT_ALLOWED"));
      expect(await countRows(attachments)).toBe(0);
      await expectNoTemporaryFiles();
    });

    it("should refuse a corrupted image", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await send(
        agent,
        patientId,
        JPEG.subarray(0, 40),
      ).expect(422);

      expect(response.body).toMatchObject(code("ATTACHMENT_CONTENT_INVALID"));
      expect(await countRows(attachments)).toBe(0);
    });

    it("should refuse a file above the limit", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await send(
        agent,
        patientId,
        Buffer.concat([PDF, Buffer.alloc(1024 * 1024)]),
      ).expect(413);

      expect(response.body).toMatchObject(code("ATTACHMENT_TOO_LARGE"));
      await expectNoTemporaryFiles();
    });

    it("should require a file", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(attachmentsUrl(patientId))
        .send({})
        .expect(422);

      expect(response.body.errors[0]).toMatchObject({
        location: "body",
        path: "file",
      });
    });

    it("should refuse a file in another field", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(attachmentsUrl(patientId))
        .attach("other", PNG, { filename: "a.png" })
        .expect(422);

      expect(response.body.errors[0]).toMatchObject({ path: "file" });
    });

    it("should answer 400 for a malformed multipart body", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(attachmentsUrl(patientId))
        .set("content-type", "multipart/form-data; boundary=x")
        .send('--x\r\nContent-Disposition: form-data; name="file"')
        .expect(400);

      expect(response.body).toMatchObject(code("INVALID_REQUEST_BODY"));
    });

    it("should reject an invalid file name", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await send(
        agent,
        patientId,
        PNG,
        `${"a".repeat(256)}.png`,
      ).expect(422);

      expect(response.body.errors[0]).toMatchObject({
        location: "body",
        path: "fileName",
      });
      await expectNoTemporaryFiles();
    });

    it("should remove the temporary file after the upload", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      await upload(agent, patientId);

      await expectNoTemporaryFiles();
    });

    it("should not accept attachments for an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      const response = await send(agent, patientId).expect(409);

      expect(response.body).toMatchObject(code("PATIENT_ARCHIVED"));
    });

    it("should not accept attachments for an unknown patient", async () => {
      const { agent } = await signedInAgent();

      await send(agent, randomUUID()).expect(404);
    });
  });

  describe("image consent", () => {
    it.each([
      ["a photo", PNG, "foto.png"],
      ["a video", MP4, "video.mp4"],
    ])(
      "should refuse %s without an active consent",
      async (_name, file, filename) => {
        const { agent } = await signedInAgent();
        const patientId = await createPatient(agent, { withConsent: false });

        const response = await send(agent, patientId, file, filename).expect(
          409,
        );

        expect(response.body).toMatchObject(
          code("ATTACHMENT_CONSENT_REQUIRED"),
        );
        expect(await countRows(attachments)).toBe(0);
        await expectNoTemporaryFiles();
      },
    );

    it("should check the detected type, not the declared one", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, { withConsent: false });

      const response = await agent
        .post(attachmentsUrl(patientId))
        .attach("file", PNG, {
          filename: "exame.pdf",
          contentType: "application/pdf",
        })
        .expect(409);

      expect(response.body).toMatchObject(code("ATTACHMENT_CONSENT_REQUIRED"));
    });

    it("should accept a PDF without consent", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, { withConsent: false });

      await send(agent, patientId, PDF, "exame.pdf").expect(201);
    });

    it("should refuse uploading and opening photos after the consent is revoked", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const photoId = await upload(agent, patientId);
      const videoId = await upload(agent, patientId, MP4);
      const pdfId = await upload(agent, patientId, PDF);
      const [consent] = (await agent.get(consentsUrl(patientId)).expect(200))
        .body;
      await agent
        .post(`${consentsUrl(patientId)}/${consent.id}/revoke`)
        .expect(200);

      const response = await send(agent, patientId).expect(409);
      expect(response.body).toMatchObject(code("ATTACHMENT_CONSENT_REQUIRED"));
      expect(await countRows(attachments)).toBe(3);

      for (const attachmentId of [photoId, videoId]) {
        const download = await agent
          .get(downloadUrl(patientId, attachmentId))
          .expect(409);
        expect(download.body).toMatchObject(
          code("ATTACHMENT_CONSENT_REQUIRED"),
        );
        expect(download.body).not.toHaveProperty("downloadUrl");
      }
      await agent.get(downloadUrl(patientId, pdfId)).expect(200);

      const downloads = await findAuditLogs(eq(auditLogs.userId, user.id));
      expect(
        downloads
          .filter(({ action }) => action === "attachment.download")
          .map(({ resourceId }) => resourceId),
      ).toEqual([pdfId]);
    });

    it("should open the photos again after a new consent", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const photoId = await upload(agent, patientId);
      const [consent] = (await agent.get(consentsUrl(patientId)).expect(200))
        .body;
      await agent
        .post(`${consentsUrl(patientId)}/${consent.id}/revoke`)
        .expect(200);
      await agent.get(downloadUrl(patientId, photoId)).expect(409);

      await agent.post(consentsUrl(patientId)).send(imageConsent).expect(201);

      await agent.get(downloadUrl(patientId, photoId)).expect(200);
    });

    it("should not open photos while the consent needs renewal", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, {
        birthDate: "2000-06-15",
        withConsent: false,
      });
      await agent
        .post(consentsUrl(patientId))
        .send({
          ...imageConsent,
          grantor: "legal_representative",
          representativeName: "Ana Lima",
          collectedAt: "2018-06-15T12:00:00Z",
        })
        .expect(201);
      const photoId = await upload(agent, patientId);

      await agent
        .put(`${API}/patients/${patientId}`)
        .send({ name: "José da Silva", birthDate: "2001-06-15" })
        .expect(200);

      const response = await agent
        .get(downloadUrl(patientId, photoId))
        .expect(409);
      expect(response.body).toMatchObject(code("ATTACHMENT_CONSENT_REQUIRED"));
    });

    it("should refuse photos while the consent needs renewal and accept them after it", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent, {
        birthDate: "2000-06-15",
        withConsent: false,
      });
      await agent
        .post(consentsUrl(patientId))
        .send({
          ...imageConsent,
          grantor: "legal_representative",
          representativeName: "Ana Lima",
          collectedAt: "2010-01-10T12:00:00Z",
        })
        .expect(201);

      const response = await send(agent, patientId).expect(409);
      expect(response.body).toMatchObject(code("ATTACHMENT_CONSENT_REQUIRED"));

      await agent.post(consentsUrl(patientId)).send(imageConsent).expect(201);
      await send(agent, patientId).expect(201);
    });

    it("should not use the consent of another patient", async () => {
      const { agent } = await signedInAgent();
      await createPatient(agent);
      const patientId = await createPatient(agent, { withConsent: false });

      await send(agent, patientId).expect(409);
    });
  });

  describe("image metadata", () => {
    it.each([
      ["JPEG", JPEG, "jpg", "image/jpeg"],
      ["PNG", PNG, "png", "image/png"],
      ["WebP", WEBP, "webp", "image/webp"],
    ])(
      "should remove GPS and identifying data from a %s and keep the orientation",
      async (_name, image, extension, contentType) => {
        const { agent } = await signedInAgent();
        const patientId = await createPatient(agent);
        const original = await withMetadata(image, extension);

        const before = await readTags(original, extension);
        expect(before.GPSLatitude).toBeDefined();
        expect(before.Orientation).toBe(6);

        const response = await send(
          agent,
          patientId,
          original,
          `foto.${extension}`,
        ).expect(201);
        expect(response.body.contentType).toBe(contentType);

        const stored = await fetchStored(agent, patientId, response.body.id);
        const after = await readTags(stored, extension);

        expect(
          Object.keys(after).filter((tag) => tag.startsWith("GPS")),
        ).toEqual([]);
        expect(after.Make).toBeUndefined();
        expect(after.Creator).toBeUndefined();
        expect(after.CreateDate).toBeUndefined();
        expect(after.Orientation).toBe(6);
        expect(stored.includes("MariaDaSilva")).toBe(false);
        expect(stored.includes("CameraDaMaria")).toBe(false);

        expect(response.body.size).toBe(stored.length);
        expect(response.body.sha256).toBe(
          createHash("sha256").update(stored).digest("hex"),
        );
      },
    );
  });

  describe("records with attachments", () => {
    it("should create a record with attachments and show them in the timeline", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const created = await agent
        .post(recordsUrl(patientId))
        .send({
          content: `Curativo attachment:${attachmentId}`,
          attachmentIds: [attachmentId],
        })
        .expect(201);

      expect(created.body.version).toBe(1);
      expect(created.body.attachments).toEqual([
        expect.objectContaining({
          id: attachmentId,
          recordId: created.body.id,
          fileName: "ferida maria.png",
        }),
      ]);

      const timeline = await agent.get(recordsUrl(patientId)).expect(200);
      expect(timeline.body.items[0].attachments[0].id).toBe(attachmentId);

      const logs = await findAuditLogs(eq(auditLogs.userId, user.id));
      expect(logs).toContainEqual(
        expect.objectContaining({
          action: "attachment.link",
          resourceId: attachmentId,
          patientId,
        }),
      );
    });

    it("should create a record with only attachments", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const created = await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(201);

      expect(created.body.content).toBeNull();
    });

    it("should keep the attachments when the record is edited or voided", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      const created = await agent
        .post(recordsUrl(patientId))
        .send({ content: "Texto", attachmentIds: [attachmentId] })
        .expect(201);
      const url = `${recordsUrl(patientId)}/${created.body.id}`;

      const edited = await agent
        .put(url)
        .send({ content: "Texto novo", version: 1 })
        .expect(200);
      expect(edited.body.attachments[0].id).toBe(attachmentId);

      const voided = await agent
        .post(`${url}/void`)
        .send({ reason: "duplicate" })
        .expect(200);
      expect(voided.body.attachments[0].id).toBe(attachmentId);
    });

    it("should require content or attachments", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [] })
        .expect(422);

      expect(response.body.errors[0]).toMatchObject({ path: "content" });
    });

    it("should not create the record when an attachment is not available", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const response = await agent
        .post(recordsUrl(patientId))
        .send({ content: "Texto", attachmentIds: [attachmentId, randomUUID()] })
        .expect(409);

      expect(response.body).toMatchObject(code("ATTACHMENT_NOT_AVAILABLE"));
      expect(await countRows(records)).toBe(0);

      const [stored] = await testDb()
        .select()
        .from(attachments)
        .where(eq(attachments.id, attachmentId));
      expect(stored?.recordId).toBeNull();
    });

    it("should not link an attachment twice", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(201);

      const response = await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(409);

      expect(response.body).toMatchObject(code("ATTACHMENT_NOT_AVAILABLE"));
    });

    it("should not link an attachment of another patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const otherPatientId = await createPatient(agent);
      const attachmentId = await upload(agent, otherPatientId);

      await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(409);
    });
  });

  describe("list", () => {
    const createRecord = async (
      agent: Agent,
      patientId: string,
      attachmentIds: string[],
    ) => {
      const response = await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds })
        .expect(201);

      return response.body.id as string;
    };

    it("should list only the attachments of records, newest first, and audit it", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const first = await upload(agent, patientId);
      const second = (
        await send(agent, patientId, PDF, "laudo.pdf").expect(201)
      ).body.id as string;
      const recordId = await createRecord(agent, patientId, [first, second]);
      await upload(agent, patientId);

      const response = await agent.get(attachmentsUrl(patientId)).expect(200);

      expect(response.body.nextCursor).toBeNull();
      expect(response.body.items).toEqual([
        expect.objectContaining({
          id: second,
          recordId,
          patientId,
          contentType: "application/pdf",
          fileName: "laudo.pdf",
        }),
        expect.objectContaining({ id: first, recordId }),
      ]);
      expect(response.body.items[0]).not.toHaveProperty("storageKey");
      expect(response.body.items[0]).not.toHaveProperty("downloadUrl");

      const logs = await findAuditLogs(eq(auditLogs.userId, user.id));
      expect(logs).toContainEqual(
        expect.objectContaining({
          action: "attachment.list",
          resourceType: "attachment",
          resourceId: null,
          patientId,
        }),
      );
    });

    it("should page with the cursor", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const ids = [
        await upload(agent, patientId),
        await upload(agent, patientId),
        await upload(agent, patientId),
      ];
      await createRecord(agent, patientId, ids);

      const firstPage = await agent
        .get(attachmentsUrl(patientId))
        .query({ limit: 2 })
        .expect(200);
      const secondPage = await agent
        .get(attachmentsUrl(patientId))
        .query({ limit: 2, cursor: firstPage.body.nextCursor })
        .expect(200);

      expect(
        firstPage.body.items.map((item: { id: string }) => item.id),
      ).toEqual([ids[2], ids[1]]);
      expect(firstPage.body.nextCursor).toBe(ids[1]);
      expect(
        secondPage.body.items.map((item: { id: string }) => item.id),
      ).toEqual([ids[0]]);
      expect(secondPage.body.nextCursor).toBeNull();
    });

    it("should only list the attachments of voided records with status=voided", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const kept = await upload(agent, patientId);
      await createRecord(agent, patientId, [kept]);
      const voided = await upload(agent, patientId);
      const voidedRecord = await createRecord(agent, patientId, [voided]);
      await agent
        .post(`${recordsUrl(patientId)}/${voidedRecord}/void`)
        .send({ reason: "wrong_patient" })
        .expect(200);

      const active = await agent.get(attachmentsUrl(patientId)).expect(200);
      const onlyVoided = await agent
        .get(attachmentsUrl(patientId))
        .query({ status: "voided" })
        .expect(200);

      expect(active.body.items.map((item: { id: string }) => item.id)).toEqual(
        [kept],
      );
      expect(
        onlyVoided.body.items.map((item: { id: string }) => item.id),
      ).toEqual([voided]);
    });

    it("should list the attachments of an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      await createRecord(agent, patientId, [attachmentId]);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      const response = await agent.get(attachmentsUrl(patientId)).expect(200);

      expect(response.body.items).toHaveLength(1);
    });

    it("should return an empty page for a patient without attachments", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent.get(attachmentsUrl(patientId)).expect(200);

      expect(response.body).toEqual({ items: [], nextCursor: null });
    });

    it("should return 404 for an unknown patient", async () => {
      const { agent } = await signedInAgent();

      const response = await agent
        .get(attachmentsUrl(randomUUID()))
        .expect(404);

      expect(response.body.code).toBe("PATIENT_NOT_FOUND");
    });

    it("should reject an invalid query", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .get(attachmentsUrl(patientId))
        .query({ limit: 0, cursor: "x", status: "all" })
        .expect(422);

      expect(
        response.body.errors.map((error: { path: string }) => error.path),
      ).toEqual(expect.arrayContaining(["limit", "cursor", "status"]));
    });
  });

  describe("download", () => {
    it("should return a signed URL without personal data and audit it", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const response = await agent
        .get(downloadUrl(patientId, attachmentId))
        .expect(200);

      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.body.downloadUrl).not.toContain("ferida");
      expect(response.body.downloadUrl).not.toContain(user.id);
      expect(response.body.downloadUrl).not.toContain(patientId);

      const logs = await findAuditLogs(eq(auditLogs.userId, user.id));
      expect(logs).toContainEqual(
        expect.objectContaining({
          action: "attachment.download",
          resourceType: "attachment",
          resourceId: attachmentId,
          patientId,
        }),
      );
    });

    it("should force the download by default and display the file with disposition=inline", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const standard = await agent
        .get(downloadUrl(patientId, attachmentId))
        .expect(200);
      const inline = await agent
        .get(downloadUrl(patientId, attachmentId))
        .query({ disposition: "inline" })
        .expect(200);

      const standardFile = await fetch(standard.body.downloadUrl);
      const inlineFile = await fetch(inline.body.downloadUrl);

      expect(standardFile.headers.get("content-disposition")).toBe("attachment");
      expect(inlineFile.headers.get("content-disposition")).toBe("inline");
      expect(inlineFile.headers.get("content-type")).toBe("image/png");
    });

    it("should tell the browser not to cache the file", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const standard = await agent
        .get(downloadUrl(patientId, attachmentId))
        .expect(200);
      const inline = await agent
        .get(downloadUrl(patientId, attachmentId))
        .query({ disposition: "inline" })
        .expect(200);

      const standardFile = await fetch(standard.body.downloadUrl);
      const inlineFile = await fetch(inline.body.downloadUrl);

      expect(standardFile.status).toBe(200);
      expect(standardFile.headers.get("cache-control")).toBe("no-store");
      expect(inlineFile.headers.get("cache-control")).toBe("no-store");
    });

    it("should reject an unknown disposition", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);

      const response = await agent
        .get(downloadUrl(patientId, attachmentId))
        .query({ disposition: "render" })
        .expect(422);

      expect(response.body.errors).toEqual([
        expect.objectContaining({ location: "query", path: "disposition" }),
      ]);
    });

    it("should not serve the file without a signature", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      const response = await agent
        .get(downloadUrl(patientId, attachmentId))
        .expect(200);

      const url = new URL(response.body.downloadUrl);
      const file = await fetch(`${url.origin}${url.pathname}`);

      expect(file.status).toBe(403);
    });

    it("should keep working for an archived patient", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      await agent.post(`${API}/patients/${patientId}/archive`).expect(200);

      await agent.get(downloadUrl(patientId, attachmentId)).expect(200);
    });

    it("should answer 404 for an unknown attachment", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);

      const response = await agent
        .get(downloadUrl(patientId, randomUUID()))
        .expect(404);

      expect(response.body).toMatchObject(code("ATTACHMENT_NOT_FOUND"));
    });
  });

  describe("isolation between nurses", () => {
    it("should not let another nurse reach the attachments", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(201);
      const { agent: other } = await otherNurse();
      const otherPatientId = await createPatient(other);

      await send(other, patientId).expect(404);
      await other.get(downloadUrl(patientId, attachmentId)).expect(404);
      await other.get(downloadUrl(otherPatientId, attachmentId)).expect(404);
      await other.get(attachmentsUrl(patientId)).expect(404);
      const otherList = await other
        .get(attachmentsUrl(otherPatientId))
        .expect(200);
      expect(otherList.body.items).toEqual([]);
      await other
        .post(recordsUrl(otherPatientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(409);
    });

    it("should require authentication", async () => {
      await request(app)
        .post(attachmentsUrl(randomUUID()))
        .attach("file", PNG, { filename: "a.png" })
        .expect(401);
    });
  });

  describe("database guarantees", () => {
    const asApp = async (ownerId: string, text: string) => {
      const client = await appClient();

      try {
        await client.query("BEGIN");
        await client.query("select set_config('app.owner_id', $1, true)", [
          ownerId,
        ]);
        return await client.query(text);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    };

    it("should hide the attachments of other owners", async () => {
      const { agent } = await signedInAgent();
      await upload(agent, await createPatient(agent));
      const { user: other } = await otherNurse();

      const result = await asApp(other.id, "SELECT * FROM attachments");

      expect(result.rows).toHaveLength(0);
    });

    it("should fail outside an owner scope", async () => {
      const client = await appClient();

      try {
        await expect(client.query("SELECT * FROM attachments")).rejects.toThrow(
          "Owner scope is not set",
        );
      } finally {
        client.release();
      }
    });

    it("should not let the API delete or change the file data", async () => {
      const { user, agent } = await signedInAgent();
      const attachmentId = await upload(agent, await createPatient(agent));

      await expect(
        asApp(user.id, `DELETE FROM attachments WHERE id = '${attachmentId}'`),
      ).rejects.toThrow("permission denied");
      await expect(
        asApp(user.id, "UPDATE attachments SET file_name = 'x'"),
      ).rejects.toThrow("permission denied");
    });

    it("should not let even the schema owner change a stored attachment", async () => {
      const { agent } = await signedInAgent();
      const attachmentId = await upload(agent, await createPatient(agent));

      await expect(
        adminQuery(
          `UPDATE attachments SET sha256 = 'x' WHERE id = '${attachmentId}'`,
        ),
      ).rejects.toThrow("The data of an attachment cannot change");
    });

    it("should not move a linked attachment to another record", async () => {
      const { agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const attachmentId = await upload(agent, patientId);
      await agent
        .post(recordsUrl(patientId))
        .send({ attachmentIds: [attachmentId] })
        .expect(201);
      const other = await agent
        .post(recordsUrl(patientId))
        .send({ content: "Outro" })
        .expect(201);

      await expect(
        adminQuery(
          `UPDATE attachments SET record_id = '${other.body.id}' WHERE id = '${attachmentId}'`,
        ),
      ).rejects.toThrow("An attachment cannot move to another record");
    });

    it("should not link an attachment to a record of another patient", async () => {
      const { agent } = await signedInAgent();
      const attachmentId = await upload(agent, await createPatient(agent));
      const otherPatientId = await createPatient(agent);
      const other = await agent
        .post(recordsUrl(otherPatientId))
        .send({ content: "Outro" })
        .expect(201);

      await expect(
        adminQuery(
          `UPDATE attachments SET record_id = '${other.body.id}' WHERE id = '${attachmentId}'`,
        ),
      ).rejects.toThrow("attachments_record_fk");
    });

    it("should ignore server-controlled fields on insert", async () => {
      const { user, agent } = await signedInAgent();
      const patientId = await createPatient(agent);
      const record = await agent
        .post(recordsUrl(patientId))
        .send({ content: "Texto" })
        .expect(201);

      const result = await adminQuery(
        `INSERT INTO attachments
          (owner_id, patient_id, record_id, author_id, file_name, content_type, size, sha256, storage_key, created_at)
         VALUES ($1, $2, $3, $1, 'a.png', 'image/png', 1, 'hash', 'attachments/k', '2000-01-01')
         RETURNING record_id, created_at`,
        [user.id, patientId, record.body.id],
      );

      expect(result.rows[0].record_id).toBeNull();
      expect(result.rows[0].created_at.getFullYear()).toBeGreaterThan(2000);
    });
  });
});
