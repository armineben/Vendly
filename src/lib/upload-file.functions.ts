import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FileUploadInput = z.object({
  base64: z.string().min(1),
  fileName: z.string().min(1),
  folder: z.string().optional().default("images"),
});

export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => FileUploadInput.parse(input))
  .handler(async ({ data }) => {
    const { base64, fileName, folder } = data;

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileExt = fileName.split(".").pop() || "png";
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${folder}/${Date.now()}-${sanitizedName}`;

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

    return { publicUrl };
  });
