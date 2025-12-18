# Otomatis.in NodeJS SDK

This is the NodeJS SDK for [Otomatis.in](https://postiz.com).

You can start by installing the package:

```bash
npm install @postiz/node
```

## Usage
```typescript
import Otomatis.in from '@postiz/node';
const postiz = new Otomatis.in('your api key', 'your self-hosted instance (optional)');
```

The available methods are:
- `post(posts: CreatePostDto)` - Schedule a post to Otomatis.in
- `postList(filters: GetPostsDto)` - Get a list of posts
- `upload(file: Buffer, extension: string)` - Upload a file to Otomatis.in
- `integrations()` - Get a list of connected channels
- `deletePost(id: string)` - Delete a post by ID

Alternatively you can use the SDK with curl, check the [Otomatis.in API documentation](https://docs.postiz.com/public-api) for more information.