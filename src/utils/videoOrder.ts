import { StoryVideo } from '../types';

const videoOrderValue = (video: StoryVideo) => {
  if (video.createdAt) {
    const createdAt = Date.parse(video.createdAt);
    if (!Number.isNaN(createdAt)) return createdAt;
  }

  const timestampFromId = /^v-(\d+)$/.exec(video.id)?.[1];
  return timestampFromId ? Number(timestampFromId) : 0;
};

export const sortVideosNewestFirst = (videos: StoryVideo[]) =>
  [...videos].sort((a, b) => videoOrderValue(b) - videoOrderValue(a));
