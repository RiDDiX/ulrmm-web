// SPDX-FileCopyrightText: 2026 RiDDiX / Maximilian Hammerschmid
// SPDX-License-Identifier: FSL-1.1-ALv2

import { useDialogPluginComponent } from "quasar";
import { useCheckModal } from "@/composables/checks";

// `defaults` fills a new check
export function useCheckDialog(props, defaults) {
  const dialog = useDialogPluginComponent();
  const form = useCheckModal({
    editCheck: props.check,
    initialState: { ...props.parent, ...defaults },
  });

  return {
    ...dialog,
    ...form,
    save: () => form.submit(dialog.onDialogOK),
  };
}
