# photo-booth

合影默认使用代码内渐变背景（青草地 / 晚霞 / 星夜 / 影棚 / 像素天）。

若要增加图片背景，把同源 webp/png 放在本目录，并在 `web/src/lib/photo-booth.ts` 的 `PHOTO_BACKGROUNDS` 中增加：

```ts
{ id: "campus", label: "校园", type: "image", src: "photo-booth/campus.webp" }
```

务必使用同源资源，否则 canvas 导出会被跨域污染。
