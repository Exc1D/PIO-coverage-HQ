"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PersonTab = { value: string; label: string; content: React.ReactNode };

/** One chart at a time instead of five side by side. The panels are rendered on the server. */
export function PersonTabs({ tabs, initial }: { tabs: PersonTab[]; initial: string }) {
  return (
    <Tabs defaultValue={initial}>
      {/* Scrolls sideways on a phone rather than wrapping into a second row. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <TabsList aria-label="Work by person">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
