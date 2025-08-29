import SessionClient from "./Client";

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  return <SessionClient sid={sid} />;
}
