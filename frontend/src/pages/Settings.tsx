import{useAuth}from'../lib/auth';
import{PageHeader,Panel,Disclaimer}from'../components/ui';
export default function SettingsPage(){
  const{user,logout}=useAuth();
  const perms:Record<string,string[]>={
    ADMIN:['Manage hospitals and patient records','Run the ETL pipeline','All analytics, OLAP and data mining','Reports and data quality','Add and remove users (via seed script)'],
    ANALYST:['View dashboards and analytics','OLAP explorer and all 9 mining algorithms','Export reports','Cannot edit records'],
    STAFF:[`Add and edit records for ${user?.hospitalName??'your hospital'}`,'Analytics limited to your hospital','Hospital reports only'],
  };
  return<>
    <PageHeader title="Settings" description="Your account, role and access."/>
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Account"><dl className="space-y-2 text-sm">{[['Name',user?.name],['Email',user?.email],['Role',user?.role],['Hospital',user?.hospitalName??'All hospitals']].map(([k,v])=>
        <div key={k as string} className="flex justify-between border-b border-ink-100 pb-2"><dt className="text-ink-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
        <button className="btn-ghost mt-4" onClick={logout}>Sign out</button></Panel>
      <Panel title="What your role can do"><ul className="list-disc space-y-1 pl-5 text-sm">{user&&perms[user.role].map(p=><li key={p}>{p}</li>)}</ul>
        <p className="mt-3 text-xs text-ink-500">Permissions are enforced by the API on every request — not just in the UI.</p></Panel>
      <div className="md:col-span-2"><Disclaimer>MumbaiCare is an academic demonstration. All data is synthetic. Sessions expire after 8 hours and are stored in sessionStorage only — data is never cached in the browser.</Disclaimer></div>
    </div>
  </>;
}
