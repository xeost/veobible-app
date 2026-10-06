import { VideoProjectEditor } from "../../../../components/VideoProjectEditor";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const { version = "rv1909" } = await searchParams;
  return (
    <VideoProjectEditor
      key={`${id}:${version}`}
      kind="long"
      catalogId={id}
      version={version}
    />
  );
}
