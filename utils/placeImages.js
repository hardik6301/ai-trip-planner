/**
 * Place-aware activity images — maps keywords in place/activity names
 * to stable Unsplash photos so cards show relevant destination imagery.
 */

const KEYWORD_IMAGES = [
  {
    keys: ["pratunam", "market", "bazaar", "shopping", "mall"],
    url: "https://images.unsplash.com/photo-1563492065-ba176002b0a4?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["wat", "temple", "arun", "cultural", "shrine", "palace"],
    url: "https://images.unsplash.com/photo-1528181304800-259f0f793548?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["bangkok", "city", "arrival", "hostel", "hotel", "check-in"],
    url: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["krabi", "beach", "island", "phi phi", "railay", "coast"],
    url: "https://images.unsplash.com/photo-1552465011-5c7f7add9763?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["street food", "food", "dinner", "restaurant", "fondue", "dining"],
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["night", "nightlife", "bar", "evening stroll"],
    url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["zermatt", "matterhorn", "glacier", "alps", "village", "swiss"],
    url: "https://images.unsplash.com/photo-1530122037263-a5f1f91d3b99?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["gondola", "cable", "railway", "gornergrat", "summit", "peak"],
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["paraglid", "adventure", "hike", "trek", "trail"],
    url: "https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["lake", "cruise", "boat", "lucerne", "brienz"],
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["airport", "transfer", "departure"],
    url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=400&fit=crop&q=80",
  },
  {
    keys: ["museum", "gallery", "bridge", "chapel"],
    url: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=400&fit=crop&q=80",
  },
];

const DESTINATION_IMAGES = {
  bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&h=400&fit=crop&q=80",
  krabi: "https://images.unsplash.com/photo-1552465011-5c7f7add9763?w=400&h=400&fit=crop&q=80",
  thailand: "https://images.unsplash.com/photo-1528181304800-259f0f793548?w=400&h=400&fit=crop&q=80",
  swiss: "https://images.unsplash.com/photo-1530122037263-a5f1f91d3b99?w=400&h=400&fit=crop&q=80",
  zermatt: "https://images.unsplash.com/photo-1530122037263-a5f1f91d3b99?w=400&h=400&fit=crop&q=80",
  alps: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop&q=80",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf128e93?w=400&h=400&fit=crop&q=80",
  bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=400&fit=crop&q=80",
  paris: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=400&fit=crop&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&h=400&fit=crop&q=80",
  manali: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=400&fit=crop&q=80",
};

const FALLBACK =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=400&fit=crop&q=80";

/**
 * @param {string} place
 * @param {string} activity
 * @param {string} [destination]
 */
export function getPlaceImage(place, activity, destination = "") {
  const haystack = `${place} ${activity} ${destination}`.toLowerCase();

  for (const entry of KEYWORD_IMAGES) {
    if (entry.keys.some((k) => haystack.includes(k))) {
      return entry.url;
    }
  }

  const destLower = destination.toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (destLower.includes(key) || haystack.includes(key)) {
      return url;
    }
  }

  return FALLBACK;
}

export { FALLBACK as PLACE_IMAGE_FALLBACK };
