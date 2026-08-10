/**
 * Types for @tabler/icons-react-native's DEEP imports.
 *
 * The package ships per-icon modules (`@tabler/icons-react-native/IconHome`),
 * which is how src/components/Icon.tsx imports them. The barrel would hand
 * Metro all 6 243 icons, and Metro does not tree-shake.
 *
 * Its `exports` map points those subpaths at `./dist/icons/*.d.ts`, but the
 * declarations actually live one level deeper at `./dist/icons/icons/*.d.ts`,
 * so TypeScript resolves the runtime module and finds no types. That is a
 * packaging bug in the library (3.46.0), not something we can configure
 * away, so this declares the shape ourselves rather than falling back to
 * `any`. Delete it if a later version fixes the paths.
 */
declare module "@tabler/icons-react-native/*" {
  import type { ComponentType } from "react";
  import type { SvgProps } from "react-native-svg";

  const Icon: ComponentType<
    SvgProps & {
      size?: number | string;
      strokeWidth?: number | string;
      title?: string;
    }
  >;
  export default Icon;
}
