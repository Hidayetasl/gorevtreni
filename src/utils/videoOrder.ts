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

export const mergeVideosById = (remote: StoryVideo[], local: StoryVideo[]) => {
  const videos = new Map<string, StoryVideo>();
  for (const video of remote) videos.set(video.id, video);
  for (const video of local) videos.set(video.id, { ...videos.get(video.id), ...video });
  return sortVideosNewestFirst([...videos.values()]);
};
