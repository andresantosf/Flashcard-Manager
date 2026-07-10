const IMGBB_API_KEY = '582931759496bce1e59c7939ffd886b6';

export async function uploadImageToImgbb(uri: string, expirationSeconds?: number) {
  const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}` +
    (expirationSeconds ? `&expiration=${Math.max(60, Math.floor(expirationSeconds))}` : '');

  const form = new FormData();
  // For React Native / Expo, append the file as an object with uri/name/type
  form.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);

  const resp = await fetch(url, { method: 'POST', body: form });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`imgbb upload failed: ${resp.status} ${text}`);
  }
  const json = await resp.json();
  if (!json || !json.success) {
    throw new Error(json?.error?.message || 'imgbb upload failed');
  }
  // return the direct image URL
  return json.data.url as string;
}

export default uploadImageToImgbb;
