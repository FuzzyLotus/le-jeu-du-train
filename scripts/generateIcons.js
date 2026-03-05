const sharp = require('sharp');

const sizes = [192, 512];
const sourceImage = 'path/to/your/source/image.png';
const outputDir = 'public/icons/';

const generateIcons = async () => {
    try {
        await Promise.all(sizes.map(size => {
            return sharp(sourceImage)
                .resize(size, size)
                .toFile(`${outputDir}${size}x${size}.png`);
        }));

        // Create maskable icons
        await sharp(sourceImage)
            .resize(512, 512)
            .toFile(`${outputDir}maskable.png`);

        console.log('Icons generated successfully!');
    } catch (error) {
        console.error('Error generating icons:', error);
    }
};

generateIcons();
