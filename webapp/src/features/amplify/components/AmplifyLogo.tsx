/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { JSX } from "react";
import { ColorSchemeImage } from "@wso2/oxygen-ui";

/**
 * The Amplify logo, cut out of the brand file onto a transparent square (192px, four times the
 * launcher tile). The dark file is the same artwork with the navy turned light slate and the blue
 * lightened: the navy measures about 1.1:1 against the default dark surface (#0f172a) and the A
 * would vanish. The orange is unchanged in both.
 */
const AMPLIFY_LOGO_SRC = {
  light: "/amplify/amplify-logo.png",
  dark: "/amplify/amplify-logo-dark.png",
};

export interface AmplifyLogoProps {
  /** Rendered size in px (square). */
  size?: number | string;
}

/**
 * Amplify's own logo, picked for the resolved colour scheme the way the top bar picks the WSO2
 * wordmark. Decorative (alt=""): wherever it sits, the product's name is already next to it.
 */
export function AmplifyLogo({ size = 48 }: AmplifyLogoProps): JSX.Element {
  return (
    <ColorSchemeImage
      src={AMPLIFY_LOGO_SRC}
      alt=""
      width={size}
      height={size}
      sx={{ display: "block", objectFit: "contain" }}
    />
  );
}
