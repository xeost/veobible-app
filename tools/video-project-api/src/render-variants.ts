import {
  socialRenderVariants,
  type SocialVariant,
  type VisualElements,
} from "./visual-elements";

/** Keep both variants on the same background and finish both before publishing outputs. */
export async function renderVideoVariants<T extends { background: string }>(
  elements: VisualElements | undefined,
  render: (
    variant: SocialVariant,
    index: number,
    count: number,
    background?: string,
  ) => Promise<T>,
) {
  const variants = socialRenderVariants(elements);
  const outputs: { variant: SocialVariant; result: T }[] = [];
  for (const [index, variant] of variants.entries()) {
    const result = await render(
      variant,
      index,
      variants.length,
      outputs[0]?.result.background,
    );
    outputs.push({ variant, result });
  }
  return outputs;
}
