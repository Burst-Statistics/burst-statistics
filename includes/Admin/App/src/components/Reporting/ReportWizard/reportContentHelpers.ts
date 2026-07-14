export const getContentBlockConfig = <T extends { id: string }>(
	availableContent: T[],
	blockId: string
) => {
	return availableContent.find( ( content ) => content.id === blockId );
};
