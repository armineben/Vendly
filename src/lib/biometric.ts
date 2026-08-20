// Lightweight biometric (Face ID / Touch ID / Windows Hello) helper based on
// the WebAuthn platform authenticator. We store the user's credentials locally
// after enrollment, and require a biometric assertion before exposing them.
//
// NOTE: This is a convenience layer for fast re-login on the same device, not
// a replacement for server-side authentication.

const STORAGE_KEY = "sf.biometric.v1";
const RP_NAME = "Vendly";

type Stored = {
  credentialId: string; // base64
  email: string;
  password: string;
};

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function biometricAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    !!navigator.credentials
  );
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!biometricAvailable()) return false;
  try {
    // @ts-ignore
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function getStored(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function clearStored() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function enrollBiometric(email: string, password: string): Promise<void> {
  if (!biometricAvailable()) throw new Error("Biométrie non supportée sur cet appareil.");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Enrôlement biométrique annulé.");

  const stored: Stored = {
    credentialId: b64encode(cred.rawId),
    email,
    password,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function verifyBiometric(): Promise<{ email: string; password: string }> {
  const stored = getStored();
  if (!stored) throw new Error("Aucune empreinte enregistrée sur cet appareil.");
  if (!biometricAvailable()) throw new Error("Biométrie non supportée.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const idBytes = b64decode(stored.credentialId);
  const allow: PublicKeyCredentialDescriptor[] = [
    {
      type: "public-key",
      id: idBytes.buffer.slice(idBytes.byteOffset, idBytes.byteOffset + idBytes.byteLength) as ArrayBuffer,
      transports: ["internal"],
    },
  ];

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: allow,
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error("Vérification biométrique échouée.");
  return { email: stored.email, password: stored.password };
}
