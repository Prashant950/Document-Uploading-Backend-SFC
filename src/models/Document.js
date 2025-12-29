// import mongoose from "mongoose";

// const documentSchema = new mongoose.Schema(
//   {
//     name: String,
//     fileName: String,
//     fileUrl: String,
//   },
//   { timestamps: true }
// );

// export default mongoose.model("Document", documentSchema);


import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    docName: String,
    fileId: mongoose.Schema.Types.ObjectId,
    originalName: String,
    contentType: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);
