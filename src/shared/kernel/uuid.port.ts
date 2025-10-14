export interface UuidService {
  v4(): string;
}

export const UUID_SERVICE = Symbol('UUID_SERVICE');
