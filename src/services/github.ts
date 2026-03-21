import axios from 'axios';

export interface RepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

export const fetchRepoTree = async (owner: string, repo: string, branch: string = 'main'): Promise<any> => {
  const response = await axios.get(`/api/github/tree`, {
    params: { owner, repo, branch }
  });
  return response.data;
};

export const fetchRawContent = async (url: string): Promise<string> => {
  const response = await axios.get(`/api/github/raw`, {
    params: { url }
  });
  return response.data;
};

export const parseGithubUrl = (url: string) => {
  try {
    const cleanUrl = url.replace(/\/$/, '');
    const parts = cleanUrl.replace('https://github.com/', '').split('/');
    return { owner: parts[0], repo: parts[1] };
  } catch (e) {
    return null;
  }
};
