import { IconScaleFilled } from "@tabler/icons-react";
import { LICENSE_HOLDER, LICENSE_TEXT, LICENSE_YEAR } from "@/lib/license";

// Body without the "MIT License" / "Copyright" lines, which are shown as the heading.
const BODY = LICENSE_TEXT.split("\n\n").slice(2).join("\n\n");

export default function LicensePanel() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-3">
        <section className="rounded-2xl bg-panel p-6 sm:p-8">
          <h2 className="mb-6 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-dim">
            <IconScaleFilled size={14} />
            License
          </h2>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">MIT LICENSE</h1>
          <p className="mt-2 text-sm text-muted">
            Copyright © {LICENSE_YEAR} {LICENSE_HOLDER}. All rights reserved.
          </p>
          <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-6 text-fg/80">
            {BODY}
          </pre>
        </section>
      </div>
    </div>
  );
}
