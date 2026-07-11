const IMGBB_API_KEY = '582931759496bce1e59c7939ffd886b6';

export async function uploadImageToImgbb(uri: string, expirationSeconds?: number) {
  const url = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}` +
    (expirationSeconds ? `&expiration=${Math.max(60, Math.floor(expirationSeconds))}` : '');
  // Fetch the file and convert to base64, then send the base64 string in the
  // `image` form field — this matches imgbb examples and works reliably in RN.
  const response = await fetch(uri);
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Failed to fetch image for upload: ${response.status} ${t}`);
  }

  const blob = await response.blob();
  // Convert blob to base64 using FileReader (works in RN/Expo)
  const base64 = await new Promise<string>((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read blob as base64'));
      reader.onload = () => {
        const result = reader.result as string;
        // result is like: data:<type>;base64,<data>
        const comma = result.indexOf(',');
        resolve(result.slice(comma + 1));
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(err);
    }
  });

  const form = new FormData();
  form.append('image', base64);

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
