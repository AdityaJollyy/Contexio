import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Dashboard() {
  return (
    <DashboardLayout>
      {({ activeFilter, searchQuery }) => (
        <div className="p-6 text-muted text-sm font-mono">
          Dashboard content coming in step 8.
          <br />
          Filter: {activeFilter} | Search: {searchQuery}
        </div>
      )}
    </DashboardLayout>
  );
}
