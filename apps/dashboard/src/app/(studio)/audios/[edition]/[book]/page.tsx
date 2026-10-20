import { AudioProjectEditor } from "../../../../../components/AudioProjectEditor";
export default async function Page({
  params,
}: {
  params: Promise<{ edition: string; book: string }>;
}) {
  const { edition, book } = await params;
  return <AudioProjectEditor edition={edition} book={book} />;
}
