import SessionClient from "./Client";

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: { sid: string } }) {
  return <SessionClient sid={params.sid} />;
}
