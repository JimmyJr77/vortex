const campaignVariant = (src: string, width: 720 | 1600) =>
  src.replace(/\.jpg$/i, `-${width}.webp`)

/** Responsive props for the optimized gymnastics campaign photography. */
export const campaignImageProps = (src: string) => ({
  src: campaignVariant(src, 1600),
  srcSet: `${campaignVariant(src, 720)} 720w, ${campaignVariant(src, 1600)} 1600w`,
  sizes: '100vw',
})
