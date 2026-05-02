const cloudinary = require('cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});

const uploadImage = async (file) => {
    try {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                {
                    folder: 'campus-events',
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve(result.secure_url);
                    }
                }
            );
            stream.end(file.buffer);
        });
    } catch (error) {
        console.error('Upload error:', error);
        throw error;
    }
};

const deleteImage = async (imageUrl) => {
    try {
        if (!imageUrl || imageUrl.trim() === '') return;
        const parts = imageUrl.split('/');
        const filename = parts[parts.length - 1];
        const folder = parts[parts.length - 2];
        const publicId = folder + '/' + filename.split('.')[0];

        await cloudinary.v2.uploader.destroy(publicId);
    } catch (error) {
        console.error('Delete error:', error);
    }
};

module.exports = {
    cloudinary,
    upload,
    uploadImage,
    deleteImage
};
