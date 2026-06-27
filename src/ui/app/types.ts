export type EnvKey = {
  key: string;
  value: string;
  encrypted: boolean;
  comment?: string;
};

export type EnvFile = {
  path: string;
  relativePath: string;
  package: string;
  environment: string;
  encrypted: boolean;
  hasPublicKey: boolean;
  keys: EnvKey[];
};
