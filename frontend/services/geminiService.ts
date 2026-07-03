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

      Identify every distinct item TYPE in the photo and count each type
      separately. Use natural, specific names a shopkeeper would recognize.

      Examples of the level of detail expected:
      - Vegetable cart: "18 carrots, 6 cabbages, 9 beetroots, 4 pineapples, 25 tomatoes, 14 onions."
      - Milk/curd tray: "This tray has 32 packets total — 20 milk packets (180ml) and 12 curd packets (500ml)."
      - Store shelf: "14 salt packets, 22 sugar packets, 10 water bottles, 8 oil packets."
      - Plant (agronomy): "This rose plant has 46 leaves, 7 buds, 5 open flowers, and is growing in 1 pot."

      For each detected item type, you must provide:
      1. A specific label (e.g., "Milk Packet 500ml", "Curd Packet 180ml", "Chocolate Bar", "Tomato").
      2. The exact count of that item type.
      3. A bounding box "box_2d" as [ymin, xmin, ymax, xmax] normalized from 0 to 100 (where 0 is top/left and 100 is bottom/right of the image) representing the general area or a key example of this item type.
      4. A confidence level ("high", "medium", "low") based on visibility and overlapping.
      5. Optional notes about overlapping or occlusion.

      Respond ONLY with valid JSON in this exact shape, no prose, no markdown fences:
      {
        "sceneDescription": "one short natural sentence summarizing what this photo shows, in the shopkeeper's own terms",
        "detectedCategory": "The general category of items detected (e.g., 'Milk Packets', 'Chocolates', 'Vegetables')",
        "totalCount": 123,
        "items": [
          {
            "label": "string (specific item name, include size/variant if visible, e.g. '180ml milk packet')",
            "count": 12,
            "box_2d": [ymin, xmin, ymax, xmax],
            "confidence": "high|medium|low",
            "notes": "short optional note, e.g. 'a few partly overlapping, counted by visible edges'"
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
              description: "List of all individual detected item types with their counts and bounding boxes",
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { 
                    type: Type.STRING, 
                    description: "Specific label/type of the item" 
                  },
                  count: {
                    type: Type.INTEGER,
                    description: "The exact count of this item type"
                  },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: "Bounding box coordinates [ymin, xmin, ymax, xmax] normalized from 0 to 100"
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
                required: ["label", "count", "box_2d"]
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
      box_2d: item.box_2d || [0, 0, 0, 0],
      confidence: item.confidence || 'high',
      notes: item.notes || ''
    }));

    return {
      sceneDescription: parsed.sceneDescription || 'Inventory items detected.',
      detectedCategory: parsed.detectedCategory || 'General Items',
      totalCount: parsed.totalCount || itemsWithIds.reduce((acc, curr) => acc + curr.count, 0),
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
