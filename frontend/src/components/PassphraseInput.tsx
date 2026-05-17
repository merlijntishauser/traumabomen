import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { PasswordInput } from "./PasswordInput";

type PassphraseInputProps = Omit<ComponentProps<typeof PasswordInput>, "showLabel" | "hideLabel">;

export function PassphraseInput(props: PassphraseInputProps) {
  const { t } = useTranslation();
  return (
    <PasswordInput
      data-1p-ignore
      showLabel={t("common.showPassphrase")}
      hideLabel={t("common.hidePassphrase")}
      {...props}
    />
  );
}
