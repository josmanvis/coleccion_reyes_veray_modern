export type GalleryPage = { searchQuery: string; visibleCount: number };
export type GalleryAction = { type: "search"; query: string } | { type: "more"; total: number };

export function galleryPagination(state: GalleryPage, action: GalleryAction): GalleryPage {
  if (action.type === "search") {
    return action.query === state.searchQuery ? state : { searchQuery: action.query, visibleCount: 30 };
  }
  return { ...state, visibleCount: Math.min(state.visibleCount + 30, action.total) };
}
