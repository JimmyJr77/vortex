import publicArticles from './publicArticles.json'
import searchPhotos from './publicSearchPhotos.json'

const tumblingImageSrcSet = `/tramp-tumble-hero-768.webp 768w, /tramp-tumble-hero-1080.webp 1080w, ${searchPhotos.tumbling} 1600w`

export const GYMNASTICS_VS_TUMBLING_GUIDE = {
  ...publicArticles.gymnasticsVsTumbling,
  breadcrumbLabel: 'Gymnastics vs. Tumbling',
  title: 'Gymnastics vs. Tumbling for Kids in Bowie, MD | Vortex',
  heading: 'Gymnastics vs. tumbling for kids',
  description:
    'Compare gymnastics and tumbling classes near Bowie, MD. See how Vortex teaches floor tumbling, which skills beginners practice, and how to try a class.',
  image: searchPhotos.tumbling,
  imageSrcSet: tumblingImageSrcSet,
  imageAvifSrcSet: '/tramp-tumble-hero-768.avif 768w, /tramp-tumble-hero-1080.avif 1080w, /tramp-tumble-hero-1600.avif 1600w',
  cardImage: searchPhotos.tumbling,
  cardImageSrcSet: tumblingImageSrcSet,
  imageAlt: 'A Vortex athlete flipping above a tumble track in Bowie, Maryland',
} as const
