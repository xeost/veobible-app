import { videoCatalogId } from "../../../../lib/video-routing";
import { VideoProjectEditor } from "../../../../components/VideoProjectEditor";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id: routeId } = await params;
  const id = videoCatalogId(routeId);
  const { version = "rv1909" } = await searchParams;
  return (
    <VideoProjectEditor
      key={`${id}:${version}`}
      kind="short"
      catalogId={id}
      version={version}
    />
  );
}
