import { VideoProjectEditor } from "../../../../components/VideoProjectEditor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VideoProjectEditor kind="short" projectId={id} />;
}
