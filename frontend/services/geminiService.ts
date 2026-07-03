import { GoogleGenAI, Type } from '@google/genai';
import { DetectedItem } from '../types';

// Initialize the Gemini client using the pre-configured environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY, vertexai: true });

/**
 * Helper to convert a base64 data URL or Blob to raw base64 string and mimeType
 */
const getBase64Data = async (imageSrc: string): Promise<{ data: string; mimeType: string }> => {
  if (imageSrc.startsWith('data:')) {
    const matches = imageSrc.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], data: matches[2] };
    }
  }
  
  const response = await fetch(imageSrc);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({ data: base64String, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Analyzes an image to detect, count, and locate items with bounding boxes.
 * Specially optimized for overlapping items in trays, boxes, jars, or shelves.
 */
export const analyzeInventoryImage = async (
  imageSrc: string,
  customCategoryHint?: string
): Promise<{ sceneDescription: string; detectedCategory: string; totalCount: number; items: DetectedItem[] }> => {
  try {
    const { data, mimeType } = await getBase64Data(imageSrc);

    const imagePart = {
      inlineData: {
        mimeType,
        data,
      },
    };

    const categoryContext = customCategoryHint 
      ? `The user expects to count items related to: "${customCategoryHint}".`
      : "Identify the primary items in bulk (e.g., milk packets, curd packets, chocolates, sweets, vegetables, cans, etc.).";

    const prompt = `
      You are Quan Scan's high-precision counting engine. A shopkeeper, vendor, store manager,
      or grower has photographed items to get an exact inventory count. You must
      always deliver a clear, confident, exact-as-possible count for everything
      visible — never respond with statements like "image unclear", "cannot
      analyze", or "please retake photo". Always do your best to count precisely,
      including items that are stacked, overlapping, or partly hidden, by
      reasoning from visible edges, packaging text, colors, shapes, and shadows.

      CRITICAL ACCURACY & COORDINATE RULES:
      1. DO NOT GENERATE MOCK GRIDS OF BOUNDING BOXES. Every bounding box "box_2d" [ymin, xmin, ymax, xmax] must correspond EXACTLY to the physical contours of an individual item in the photo.
      2. If items are in a crate/tray/box, count them systematically: stack by stack, row by row, column by column. Look at the seams, folded edges, text, and logos to verify where one item ends and another begins. A standard milk packet crate usually holds rows of 5 or 6 packets. Trace the edges to find the exact number (e.g. 12 packets, NOT a random guess of 14).
      3. Avoid double-counting overlapping items. If a packet is stacked on top of another, trace the boundaries of the top packet and the visible boundaries of the bottom packet separately.
      4. Verify the final count: perform a mental count and ensure the number of entries in the "items" array is EXACTLY equal to the count of physical items.

      You must locate and return a SEPARATE entry in the "items" list for EVERY SINGLE INDIVIDUAL item visible.
      For example, if there are 12 milk packets on a tray, your "items" array must contain EXACTLY 12 separate entries, each representing a single packet and each having its own specific bounding box "box_2d" enclosing that specific packet.
      DO NOT group them into a single entry with a high count; return 1 entry per item.

      For each detected item, you must provide:
      1. A specific label (e.g., "Milk Packet 500ml", "Curd Packet 180ml", "Chocolate Bar", "Tomato").
      2. A bounding box "box_2d" as [ymin, xmin, ymax, xmax] normalized from 0 to 1000 (where 0 is top/left and 1000 is bottom/right of the image) enclosing that specific individual item.
      3. A confidence level ("high", "medium", "low") based on visibility.
      4. Optional notes about overlapping or occlusion.

      Respond ONLY with valid JSON in this exact shape, no prose, no markdown fences:
      {
        "sceneDescription": "one short natural sentence summarizing what this photo shows, in the shopkeeper's own terms",
        "detectedCategory": "The general category of items detected (e.g., 'Milk Packets', 'Chocolates', 'Vegetables')",
        "totalCount": 12,
        "items": [
          {
            "label": "string (specific item name, include size/variant if visible, e.g. '180ml milk packet')",
            "box_2d": [ymin, xmin, ymax, xmax],
            "confidence": "high|medium|low",
            "notes": "short optional note, e.g. 'partly overlapping, counted by visible edges'"
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        imagePart,
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneDescription: {
              type: Type.STRING,
              description: "One short natural sentence summarizing what this photo shows"
            },
            detectedCategory: { 
              type: Type.STRING, 
              description: "The general category of items detected (e.g., 'Milk Packets', 'Chocolates', 'Vegetables')" 
            },
            totalCount: { 
              type: Type.INTEGER, 
              description: "The total count of items detected" 
            },
            items: {
              type: Type.ARRAY,
              description: "List of all individual detected items, one entry per physical item",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { 
                    type: Type.STRING, 
                    description: "Specific label/type of the item" 
                  },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: "Bounding box coordinates [ymin, xmin, ymax, xmax] normalized from 0 to 1000"
                  },
                  confidence: {
                    type: Type.STRING,
                    description: "Confidence level of detection: high, medium, or low"
                  },
                  notes: {
                    type: Type.STRING,
                    description: "Optional notes about overlapping or occlusion"
                  }
                },
                required: ["label", "box_2d"]
              }
            }
          },
          required: ["sceneDescription", "detectedCategory", "totalCount", "items"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response received from Gemini API.");
    }

    const parsed = JSON.parse(resultText);
    
    const itemsWithIds: DetectedItem[] = (parsed.items || []).map((item: any, index: number) => {
      const box = item.box_2d || [0, 0, 0, 0];
      // Convert 0-1000 native scale to 0-100 percentage
      const normalizedBox = box.map((val: number) => val / 10);
      return {
        id: `item-${Date.now()}-${index}`,
        label: item.label || 'Item',
        count: 1, // Dynamically fill count as 1 since each is an individual item
        box_2d: normalizedBox,
        confidence: item.confidence || 'high',
        notes: item.notes || ''
      };
    });

    return {
      sceneDescription: parsed.sceneDescription || 'Inventory items detected.',
      detectedCategory: parsed.detectedCategory || 'General Items',
      totalCount: itemsWithIds.length || parsed.totalCount || 0,
      items: itemsWithIds
    };
  } catch (error) {
    console.error("Error in analyzeInventoryImage:", error);
    throw error;
  }
};

/**
 * Analyzes multiple images together (Batch Mode) and combines the counts.
 */
export const analyzeInventoryImageBatch = async (
  imageSrcs: string[]
): Promise<{ sceneDescription: string; detectedCategory: string; totalCount: number; items: DetectedItem[] }> => {
  try {
    const imageParts = await Promise.all(imageSrcs.map(async (src) => {
      const { data, mimeType } = await getBase64Data(src);
      return {
        inlineData: {
          mimeType,
          data,
        }
      };
    }));

    const prompt = `
      You are given MULTIPLE photos from the same session (e.g. several trays scanned today).
      Combine the counts across all photos into ONE unified breakdown per item type, and also return totalCount as the grand total across all photos.
      
      Respond ONLY with valid JSON in this exact shape, no prose, no markdown fences:
      {
        "sceneDescription": "one short natural sentence summarizing the combined batch of photos",
        "detectedCategory": "The general category of items detected (e.g., 'Milk Packets', 'Chocolates', 'Vegetables')",
        "totalCount": 123,
        "items": [
          {
            "label": "string (specific item name, include size/variant if visible)",
            "count": 12,
            "confidence": "high|medium|low",
            "notes": "short optional note"
          }
        ]
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...imageParts,
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneDescription: {
              type: Type.STRING,
              description: "One short natural sentence summarizing the combined batch of photos"
            },
            detectedCategory: { 
              type: Type.STRING, 
              description: "The general category of items detected" 
            },
            totalCount: { 
              type: Type.INTEGER, 
              description: "The total count of items detected across all photos" 
            },
            items: {
              type: Type.ARRAY,
              description: "List of all combined detected item types with their counts",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { 
                    type: Type.STRING, 
                    description: "Specific label/type of the item" 
                  },
                  count: {
                    type: Type.INTEGER,
                    description: "The exact combined count of this item type"
                  },
                  confidence: {
                    type: Type.STRING,
                    description: "Confidence level of detection: high, medium, or low"
                  },
                  notes: {
                    type: Type.STRING,
                    description: "Optional notes about overlapping or occlusion"
                  }
                },
                required: ["label", "count"]
              }
            }
          },
          required: ["sceneDescription", "detectedCategory", "totalCount", "items"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No response received from Gemini API.");
    }

    const parsed = JSON.parse(resultText);
    
    const itemsWithIds: DetectedItem[] = (parsed.items || []).map((item: any, index: number) => ({
      id: `item-${Date.now()}-${index}`,
      label: item.label || 'Item',
      count: item.count || 1,
      confidence: item.confidence || 'high',
      notes: item.notes || ''
    }));

    return {
      sceneDescription: parsed.sceneDescription || 'Combined batch inventory items detected.',
      detectedCategory: parsed.detectedCategory || 'Combined Batch',
      totalCount: parsed.totalCount || itemsWithIds.reduce((acc, curr) => acc + curr.count, 0),
      items: itemsWithIds
    };
  } catch (error) {
    console.error("Error in analyzeInventoryImageBatch:", error);
    throw error;
  }
};
