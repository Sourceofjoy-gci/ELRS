/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare module 'jose' {
  export function jwtDecode<T = unknown>(token: string): T
}
