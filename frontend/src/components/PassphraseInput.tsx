import { type ComponentProps, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { PasswordInput } from "./PasswordInput";

type PassphraseInputProps = Omit<ComponentProps<typeof PasswordInput>, "showLabel" | "hideLabel">;

export const PassphraseInput = forwardRef<HTMLInputElement, PassphraseInputProps>(
  function PassphraseInput(props, ref) {
    const { t } = useTranslation();
    return (
      <PasswordInput
        ref={ref}
        data-1p-ignore
        showLabel={t("common.showPassphrase")}
        hideLabel={t("common.hidePassphrase")}
        {...props}
      />
    );
  },
);
