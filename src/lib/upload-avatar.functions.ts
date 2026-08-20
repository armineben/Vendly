import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AvatarInput = z.object({
  base64: z.string().min(1),
  fileName: z.string().min(1),
});

export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AvatarInput.parse(input))
  .handler(async ({ data, context }) => {
    const { base64, fileName } = data;
    const userId = context.userId;

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileExt = fileName.split(".").pop() || "png";
    const filePath = `avatars/${userId}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("product-images")
      .upload(filePath, buffer, {
        contentType: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("product-images")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, avatar_url: publicUrl });
    if (updateError) throw new Error(updateError.message);

    return { avatarUrl: publicUrl };
  });
